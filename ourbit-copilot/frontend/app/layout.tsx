import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Ourbit · BD 워크룸',description:'내부 KOL 발굴 및 제안 검토',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="ko"><body>{children}</body></html>;
}
