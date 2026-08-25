param(
  [string]$SourceDir = "",
  [string]$OutputPath = ".\app\excel-data.json",
  [int]$MaxRowsPerSheet = 120,
  [int]$MaxColsPerSheet = 80
)

$ErrorActionPreference = "Stop"

if ($SourceDir -eq "") {
  $defaultTemplateFolderName = -join @([char]0x5BFC, [char]0x5165, [char]0x6A21, [char]0x677F)
  $SourceDir = Join-Path $env:USERPROFILE ("Downloads\" + $defaultTemplateFolderName)
}

function Get-CellText {
  param($sheet, [int]$row, [int]$col)
  $value = $sheet.Cells.Item($row, $col).Text
  if ($null -eq $value) { return "" }
  return [string]$value
}

if (-not (Test-Path -LiteralPath $SourceDir)) {
  throw "模板目录不存在：$SourceDir"
}

$resolvedOutput = Resolve-Path -LiteralPath (Split-Path -Parent $OutputPath) -ErrorAction SilentlyContinue
if (-not $resolvedOutput) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$workbooks = @()

try {
  foreach ($file in Get-ChildItem -LiteralPath $SourceDir -File -Filter "*.xls" | Sort-Object Name) {
    $wb = $excel.Workbooks.Open($file.FullName, $null, $true)
    try {
      $book = [ordered]@{
        fileName = $file.Name
        fullPath = $file.FullName
        fileSize = $file.Length
        updatedAt = $file.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
        sheets = @()
      }

      foreach ($ws in $wb.Worksheets) {
        $used = $ws.UsedRange
        $rowCount = [Math]::Min([int]$used.Rows.Count, $MaxRowsPerSheet)
        $colCount = [Math]::Min([int]$used.Columns.Count, $MaxColsPerSheet)
        $rows = @()
        $headers = @()
        $requiredFields = @()

        for ($c = 1; $c -le $colCount; $c++) {
          $header = Get-CellText $ws 1 $c
          if ($header -ne "") {
            $headers += [ordered]@{ column = $c; name = $header; required = $header.StartsWith("*") }
            if ($header.StartsWith("*")) { $requiredFields += $header }
          }
        }

        for ($r = 1; $r -le $rowCount; $r++) {
          $cells = @()
          for ($c = 1; $c -le $colCount; $c++) {
            $value = Get-CellText $ws $r $c
            if ($value -ne "") {
              $cells += [ordered]@{ column = $c; value = $value }
            }
          }
          if ($cells.Count -gt 0) {
            $rows += [ordered]@{ row = $r; cells = $cells }
          }
        }

        $book.sheets += [ordered]@{
          name = $ws.Name
          usedRows = [int]$used.Rows.Count
          usedCols = [int]$used.Columns.Count
          capturedRows = $rowCount
          capturedCols = $colCount
          headers = $headers
          requiredFields = $requiredFields
          rows = $rows
        }
      }
    }
    finally {
      $wb.Close($false)
    }

    $workbooks += $book
  }
}
finally {
  $excel.Quit() | Out-Null
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}

$payload = [ordered]@{
  generatedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  sourceDir = $SourceDir
  workbookCount = $workbooks.Count
  workbooks = $workbooks
}

$json = $payload | ConvertTo-Json -Depth 20
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$outputFullPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
[System.IO.File]::WriteAllText($outputFullPath, $json, $utf8NoBom)
Write-Output "已生成：$OutputPath"
Write-Output "工作簿数量：$($workbooks.Count)"
