import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

export function AboutDialog({ open, onOpenChange, version }: { open: boolean; onOpenChange: (open: boolean) => void; version: string | null }) {
  const [license, setLicense] = useState('Loading the license…')

  useEffect(() => {
    if (!open || !window.phoneMirror) return
    let cancel = false
    void window.phoneMirror.readLicense().then((text) => {
      if (!cancel) setLicense(text)
    })
    return () => {
      cancel = true
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(560px,calc(100%-32px))]">
        <DialogTitle>About Phone Mirror</DialogTitle>
        <DialogDescription>
          Phone Mirror shows an Android phone on this PC by running scrcpy. Nothing is installed on the phone.
        </DialogDescription>
        <p className="mt-4 text-sm">
          {version ? `Bundled scrcpy ${version}.` : 'scrcpy version unknown.'} scrcpy is copyright Genymobile and Romain Vimont and is licensed under the Apache License 2.0.
        </p>
        <h3 className="mt-4 text-sm font-semibold">scrcpy license</h3>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-sm border border-border bg-muted p-3 font-mono text-[12px] leading-5">{license}</pre>
      </DialogContent>
    </Dialog>
  )
}
