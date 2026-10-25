"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface PreviewNoticeInput {
  /** The action the person just attempted, e.g. "Add activity". */
  action: string;
  description: string;
  /** The phase where this becomes real, e.g. "Phase 2 — Authentication and trips". */
  phase?: string;
}

interface PreviewContextValue {
  openNotice: (notice: PreviewNoticeInput) => void;
}

const PreviewContext = createContext<PreviewContextValue | null>(null);

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<PreviewNoticeInput | null>(null);

  const openNotice = useCallback((nextNotice: PreviewNoticeInput) => {
    setNotice(nextNotice);
  }, []);

  const value = useMemo(() => ({ openNotice }), [openNotice]);

  return (
    <PreviewContext.Provider value={value}>
      {children}

      <Dialog open={Boolean(notice)} onOpenChange={(open) => !open && setNotice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <Badge variant="clay" className="mb-2 w-fit">
              <Eye aria-hidden="true" className="size-3" />
              Design preview
            </Badge>
            <DialogTitle>{notice?.action} isn&apos;t connected yet</DialogTitle>
            <DialogDescription>{notice?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-lg border border-line bg-paper-50 p-4 text-[13px] leading-5 text-ink-700">
            <p className="font-semibold text-forest-900">What this build actually does</p>
            <ul className="space-y-1.5">
              <li className="flex gap-2">
                <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-forest-600" />
                Navigation, layout and responsive behaviour are real.
              </li>
              <li className="flex gap-2">
                <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-forest-600" />
                The trips and people shown are clearly labelled sample data.
              </li>
              <li className="flex gap-2">
                <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-clay-500" />
                Nothing is saved, and no account or AI service is connected yet.
              </li>
            </ul>
          </div>

          {notice?.phase && (
            <p className="mt-3 text-[12px] text-ink-500">
              Planned for <span className="font-medium text-forest-800">{notice.phase}</span>.
            </p>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setNotice(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PreviewContext.Provider>
  );
}

export function usePreviewNotice() {
  const context = useContext(PreviewContext);
  if (!context) {
    throw new Error("usePreviewNotice must be used inside PreviewProvider");
  }
  return context;
}
