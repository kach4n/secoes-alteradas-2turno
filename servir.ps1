# Servidor estático mínimo para a pasta docs/ em http://localhost:8080
param([int]$Porta = 8080)
$raiz = Join-Path $PSScriptRoot 'docs'
$tipos = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css'; '.json' = 'application/json' }
$http = [System.Net.HttpListener]::new()
$http.Prefixes.Add("http://localhost:$Porta/")
$http.Start()
Write-Host "Servindo $raiz em http://localhost:$Porta/ (Ctrl+C para parar)"
while ($http.IsListening) {
  $ctx = $http.GetContext()
  $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  if ($rel -eq '') { $rel = 'index.html' }
  $arq = [IO.Path]::GetFullPath((Join-Path $raiz $rel))
  if ($arq.StartsWith($raiz) -and (Test-Path $arq -PathType Leaf)) {
    $bytes = [IO.File]::ReadAllBytes($arq)
    $ext = [IO.Path]::GetExtension($arq)
    $ctx.Response.ContentType = if ($tipos[$ext]) { $tipos[$ext] } else { 'application/octet-stream' }
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else { $ctx.Response.StatusCode = 404 }
  $ctx.Response.Close()
}
