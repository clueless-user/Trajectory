import React, { useState } from "react";
import { Modal } from "./common/Modal";
import { useUIStore } from "../stores/useUIStore";
import { useTaskStore } from "../stores/useTaskStore";
import { compressDayPlan } from "../domain/compression/compression";
import { Button } from "./common/Button";
import { ShieldAlert, ArrowRight, CheckCircle2 } from "lucide-react";

export const CompressionModal: React.FC = () => {
  const { isCompressionModalOpen, setCompressionModalOpen } = useUIStore();
  const { tasks, availableMinutes, compressPlan } = useTaskStore();
  const [isCompressing, setIsCompressing] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];
  const compressionResult = compressDayPlan(tasks, availableMinutes);

  const handleApply = async () => {
    setIsCompressing(true);
    try {
      await compressPlan(todayStr);
      setCompressionModalOpen(false);
    } catch (err) {
      console.error("Compression error:", err);
    } finally {
      setIsCompressing(false);
    }
  };

  return (
    <Modal
      isOpen={isCompressionModalOpen}
      onClose={() => setCompressionModalOpen(false)}
      title="Day Compression (Survival Mode)"
      subtitle="Deterministically realign your day without guilt or loss of momentum."
      maxWidth="max-w-xl"
    >
      <div className="flex flex-col gap-4">
        {/* Metric summary banner */}
        <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-xs font-semibold text-zinc-100">
                Plan Exceeds Capacity by {Math.max(0, compressionResult.totalPlannedMinutes - availableMinutes)}m
              </div>
              <div className="text-[11px] text-zinc-400">
                Total Planned: {compressionResult.totalPlannedMinutes}m | Available: {availableMinutes}m
              </div>
            </div>
          </div>
          <div className="text-right font-mono text-xs text-cyan-400 font-semibold">
            -{compressionResult.freedMinutes}m freed
          </div>
        </div>

        {/* Kept tasks preview */}
        <div>
          <div className="text-xs font-semibold text-zinc-200 mb-1.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Preserved Work (Priority & Leverage)</span>
          </div>
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
            {compressionResult.keptTasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-2 rounded bg-zinc-950/60 border border-zinc-850 text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      t.importance === "critical" ? "bg-rose-400" : "bg-cyan-400"
                    }`}
                  />
                  <span className="text-zinc-200 truncate">{t.title}</span>
                </div>
                <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                  {t.estimated_minutes}m
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Deferred tasks preview */}
        {compressionResult.deferredTasks.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
              <span>Pushed to Deferred (No Guilt)</span>
            </div>
            <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto pr-1">
              {compressionResult.deferredTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2 rounded bg-zinc-950/30 border border-zinc-850/60 text-xs text-zinc-500"
                >
                  <span className="truncate">{t.title}</span>
                  <span className="font-mono text-[11px] shrink-0">{t.estimated_minutes}m</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800/80">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setCompressionModalOpen(false)}
          >
            Keep Original Plan
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleApply}
            disabled={isCompressing || compressionResult.deferredTasks.length === 0}
          >
            Apply Day Compression
          </Button>
        </div>
      </div>
    </Modal>
  );
};
