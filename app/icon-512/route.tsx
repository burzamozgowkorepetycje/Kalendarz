import { ImageResponse } from 'next/og'

export const dynamic = 'force-static'

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
          color: 'white',
          fontSize: 256,
          fontWeight: 800,
          letterSpacing: -10,
        }}
      >
        BM
      </div>
    ),
    { width: 512, height: 512 }
  )
}
