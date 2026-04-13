import Papa from 'papaparse'
import { useMemo, useState } from 'react'

type OutputFormat = 'png' | 'jpeg' | 'webp' | 'csv' | 'json' | 'txt' | 'md'

type ConversionResult = {
  blob: Blob
  extension: OutputFormat
}

function getBaseName(fileName: string) {
  const index = fileName.lastIndexOf('.')
  if (index <= 0) {
    return fileName
  }
  return fileName.slice(0, index)
}

function getImageOutputMime(format: OutputFormat) {
  if (format === 'jpeg') {
    return 'image/jpeg'
  }
  if (format === 'webp') {
    return 'image/webp'
  }
  return 'image/png'
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Failed to read file as text'))
    reader.readAsText(file)
  })
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Failed to read file as data URL'))
    reader.readAsDataURL(file)
  })
}

async function convertImage(file: File, format: OutputFormat): Promise<ConversionResult> {
  const dataUrl = await readFileAsDataUrl(file)
  const image = new Image()
  const ready = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Failed to decode image'))
  })
  image.src = dataUrl
  await ready

  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas is unavailable')
  }
  ctx.drawImage(image, 0, 0)

  const mime = getImageOutputMime(format)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (!nextBlob) {
        reject(new Error('Failed to encode converted image'))
        return
      }
      resolve(nextBlob)
    }, mime)
  })

  return { blob, extension: format }
}

async function convertTextLike(file: File, format: OutputFormat): Promise<ConversionResult> {
  const text = await readFileAsText(file)

  if (format === 'txt' || format === 'md') {
    return {
      blob: new Blob([text], { type: 'text/plain;charset=utf-8' }),
      extension: format,
    }
  }

  if (format === 'json') {
    return {
      blob: new Blob([text], { type: 'application/json;charset=utf-8' }),
      extension: 'json',
    }
  }

  if (format === 'csv') {
    return {
      blob: new Blob([text], { type: 'text/csv;charset=utf-8' }),
      extension: 'csv',
    }
  }

  throw new Error('Unsupported text conversion')
}

async function convertJsonCsv(file: File, format: OutputFormat): Promise<ConversionResult> {
  const text = await readFileAsText(file)

  if (format === 'csv') {
    const raw = JSON.parse(text) as unknown
    const normalized = Array.isArray(raw) ? raw : [raw]
    const csv = Papa.unparse(normalized as Array<Record<string, unknown>>)
    return {
      blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      extension: 'csv',
    }
  }

  if (format === 'json') {
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    })
    if (parsed.errors.length > 0) {
      throw new Error(parsed.errors[0]?.message ?? 'CSV parse failed')
    }
    const json = JSON.stringify(parsed.data, null, 2)
    return {
      blob: new Blob([json], { type: 'application/json;charset=utf-8' }),
      extension: 'json',
    }
  }

  throw new Error('Unsupported CSV/JSON conversion')
}

function detectConversionProfile(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mime = file.type.toLowerCase()

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    return {
      kind: 'image' as const,
      options: ['png', 'jpeg', 'webp'] as OutputFormat[],
    }
  }

  if (ext === 'json') {
    return {
      kind: 'json' as const,
      options: ['csv', 'txt'] as OutputFormat[],
    }
  }

  if (ext === 'csv') {
    return {
      kind: 'csv' as const,
      options: ['json', 'txt'] as OutputFormat[],
    }
  }

  if (ext === 'txt' || ext === 'md' || mime.startsWith('text/')) {
    return {
      kind: 'text' as const,
      options: ['txt', 'md'] as OutputFormat[],
    }
  }

  return {
    kind: 'unsupported' as const,
    options: [] as OutputFormat[],
  }
}

async function convertFile(file: File, format: OutputFormat): Promise<ConversionResult> {
  const profile = detectConversionProfile(file)

  if (profile.kind === 'image') {
    return convertImage(file, format)
  }

  if (profile.kind === 'json' || profile.kind === 'csv') {
    if (format === 'txt') {
      return convertTextLike(file, 'txt')
    }
    return convertJsonCsv(file, format)
  }

  if (profile.kind === 'text') {
    return convertTextLike(file, format)
  }

  throw new Error('Unsupported file type for local conversion')
}

export function FileConverter() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [targetFormat, setTargetFormat] = useState<OutputFormat | ''>('')
  const [status, setStatus] = useState('')
  const [isConverting, setIsConverting] = useState(false)

  const profile = useMemo(() => {
    if (!selectedFile) {
      return null
    }
    return detectConversionProfile(selectedFile)
  }, [selectedFile])

  const options = profile?.options ?? []

  return (
    <div className="flex h-full flex-col gap-3 text-slate-200">
      <p className="text-sm text-slate-300">
        Convert files locally in your browser. Nothing is uploaded to a server.
      </p>

      <label className="pixel-button inline-flex h-9 w-fit cursor-pointer items-center px-3 text-[9px]">
        Select File
        <input
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null
            setSelectedFile(file)
            setStatus('')
            setTargetFormat('')
          }}
        />
      </label>

      {selectedFile ? (
        <div className="rounded-md border border-white/15 bg-white/5 p-3 text-xs text-slate-300">
          <div>File: {selectedFile.name}</div>
          <div>Size: {(selectedFile.size / 1024).toFixed(1)} KB</div>
          <div>
            Type: {profile?.kind === 'unsupported' ? 'Unsupported' : (profile?.kind ?? 'Unknown')}
          </div>
        </div>
      ) : null}

      {profile?.kind === 'unsupported' ? (
        <div className="rounded-md border border-amber-300/30 bg-amber-200/10 p-3 text-xs text-amber-200">
          Unsupported type. Supported inputs: image (png/jpg/webp), csv, json, txt, md.
        </div>
      ) : null}

      {options.length > 0 ? (
        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="converter-format">Convert to</label>
          <select
            id="converter-format"
            value={targetFormat}
            onChange={(event) => setTargetFormat(event.target.value as OutputFormat)}
            className="pixel-input h-8 bg-white px-2 text-[11px] text-slate-900"
          >
            <option value="">Choose format</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <button
        type="button"
        className="pixel-button h-9 px-3 text-[9px] disabled:opacity-40"
        disabled={!selectedFile || !targetFormat || isConverting || profile?.kind === 'unsupported'}
        onClick={async () => {
          if (!selectedFile || !targetFormat) {
            return
          }

          setIsConverting(true)
          setStatus('Converting...')

          try {
            const result = await convertFile(selectedFile, targetFormat)
            const baseName = getBaseName(selectedFile.name)
            const outputName = `${baseName}.${result.extension}`
            const url = URL.createObjectURL(result.blob)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = outputName
            anchor.click()
            URL.revokeObjectURL(url)
            setStatus(`Done: ${outputName}`)
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Conversion failed'
            setStatus(`Error: ${message}`)
          } finally {
            setIsConverting(false)
          }
        }}
      >
        {isConverting ? 'Converting...' : 'Convert & Download'}
      </button>

      {status ? <p className="text-xs text-slate-300">{status}</p> : null}
    </div>
  )
}
