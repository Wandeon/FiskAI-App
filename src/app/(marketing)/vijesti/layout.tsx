import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

export default function VijestiLayout({ children }: { children: React.ReactNode }) {
  return (
    <SectionBackground variant="dark" showOrbs showGrid>
      {children}
    </SectionBackground>
  )
}
