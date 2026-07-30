import { Button } from "@/components/ui/button";
import { Mic, Pause, Play, Square } from "lucide-react";

interface ControlButtonsProps {
  isRecording: boolean;
  isPaused: boolean;
  isTranscribing: boolean;
  isPatientSelected: boolean;
  audioURL: string | null;
  permissionDenied: boolean;
  onStartRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onStopRecording: () => void;
}

export function ControlButtons({
  isRecording,
  isPaused,
  isTranscribing,
  isPatientSelected,
  audioURL,
  permissionDenied,
  onStartRecording,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
}: ControlButtonsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {!isPatientSelected && (
        <Button variant="outline" size="lg" disabled>
          Seleccione un paciente primero
        </Button>
      )}

      {isPatientSelected && !isRecording && !isTranscribing && !audioURL && (
        <Button
          type="button"
          size="lg"
          className="h-14 min-w-56 rounded-xl bg-primary px-8 text-base font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-lg"
          onClick={onStartRecording}
          disabled={permissionDenied}
        >
          <Mic className="mr-3 h-5 w-5" />
          Iniciar grabación
        </Button>
      )}

      {isRecording && !isPaused && (
        <>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onPauseRecording}
            className="border-amber-400 text-amber-700 hover:bg-amber-50"
          >
            <Pause className="mr-2 h-4 w-4" />
            Pausar
          </Button>

          <Button type="button" variant="destructive" size="lg" onClick={onStopRecording}>
            <Square className="mr-2 h-4 w-4" />
            Detener y transcribir
          </Button>
        </>
      )}

      {isRecording && isPaused && (
        <>
          <Button
            type="button"
            size="lg"
            className="h-11 rounded-xl bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={onResumeRecording}
          >
            <Play className="mr-2 h-4 w-4" />
            Reanudar
          </Button>

          <Button type="button" variant="destructive" size="lg" onClick={onStopRecording}>
            <Square className="mr-2 h-4 w-4" />
            Detener y transcribir
          </Button>
        </>
      )}
    </div>
  );
}
