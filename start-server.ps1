<#
.SYNOPSIS
    Lightweight HTTP Server per Dispensa & Cassa Smart PWA
.DESCRIPTION
    Avvia un server web locale su http://localhost:8080 per testare il Service Worker,
    la fotocamera per i codici a barre/QR e l'installazione PWA.
#>

$port = 8080
$folder = $PSScriptRoot

if (-not $folder) {
    $folder = Get-Location
}

$listener = New-Object System.Net.HttpListener
$url = "http://localhost:$port/"
$listener.Prefixes.Add($url)

try {
    $listener.Start()
} catch {
    Write-Host "Porta $port occupata, provo 8081..." -ForegroundColor Yellow
    $port = 8081
    $url = "http://localhost:$port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($url)
    $listener.Start()
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   🛒 Dispensa & Cassa Smart - Progressive Web App" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Server avviato con successo su: $url" -ForegroundColor Yellow
Write-Host "Directory radice: $folder" -ForegroundColor DarkGray
Write-Host "Premi CTRL+C per arrestare il server.`n" -ForegroundColor DarkGray

# Apri automaticamente nel browser predefinito
Start-Process $url

$mimeMap = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".webmanifest" = "application/manifest+json"
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $relPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($relPath)) {
            $relPath = "index.html"
        }

        # Query strings remove
        if ($relPath.Contains('?')) {
            $relPath = $relPath.Split('?')[0]
        }

        $localPath = [System.IO.Path]::Combine($folder, $relPath.Replace('/', '\'))

        if ([System.IO.File]::Exists($localPath)) {
            $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
            $mime = "application/octet-stream"
            if ($mimeMap.ContainsKey($ext)) {
                $mime = $mimeMap[$ext]
            }

            # Manifest special case
            if ($localPath.EndsWith("manifest.json")) {
                $mime = "application/manifest+json; charset=utf-8"
            }

            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.AddHeader("Cache-Control", "no-cache")
            $response.StatusCode = 200
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 File Not Found: $relPath")
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }

        $response.Close()
    } catch {
        # Catch connection closures
    }
}
