"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Trash2 } from "lucide-react"

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title: string
  description: string
  itemName?: string
  isLoading?: boolean
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  itemName,
  isLoading = false
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#1a1a1a] border-[#333333] text-white [&>button]:text-[#666666] [&>button:hover]:text-red-500 [&>button]:bg-transparent [&>button:hover]:bg-transparent">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <DialogTitle className="text-xl font-semibold text-white">
            {title}
          </DialogTitle>
          <div className="mt-2 text-sm text-gray-300">
            {description}
            {itemName && (
              <div className="mt-2 font-medium text-white">
                「{itemName}」
              </div>
            )}
          </div>
        </DialogHeader>
        
        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="w-full sm:w-auto bg-transparent border-[#333333] text-gray-300 hover:bg-[#333333] hover:text-white"
          >
            キャンセル
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white border-none"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                削除中...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                削除する
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
