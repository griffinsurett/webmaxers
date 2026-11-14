// src/hooks/autoplay/usePauseableState.ts
import { useCallback, useEffect, useRef, useState } from "react";

export interface UsePauseableStateOptions {
  initialPausedState?: boolean;
  resumeTriggers?: string[];
  resumeDelay?: number;
}

export const usePauseableState = ({
  initialPausedState = false,
  resumeTriggers = ["scroll", "click-outside", "hover-away"],
  resumeDelay = 5000,
}: UsePauseableStateOptions = {}) => {
  const [isPaused, setIsPaused] = useState(initialPausedState);
  const [userEngaged, setUserEngaged] = useState(false);
  const [shouldPauseAfterVideo, setShouldPauseAfterVideo] = useState(false);
  const [isResumeScheduled, setIsResumeScheduled] = useState(false);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelScheduledResume = useCallback(() => {
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
    setIsResumeScheduled(false);
  }, []);

  const scheduleResume = useCallback(() => {
    cancelScheduledResume();
    setIsResumeScheduled(true);
    resumeTimeoutRef.current = setTimeout(() => {
      setIsResumeScheduled(false);
      setUserEngaged(false);
      setShouldPauseAfterVideo(false);
      setIsPaused(false);
    }, resumeDelay);
  }, [cancelScheduledResume, resumeDelay]);

  const pause = useCallback(() => setIsPaused(true), []);

  const resume = useCallback(() => {
    cancelScheduledResume();
    setIsPaused(false);
    setUserEngaged(false);
    setShouldPauseAfterVideo(false);
  }, [cancelScheduledResume]);

  const toggle = useCallback(() => setIsPaused((prev) => !prev), []);

  const engageUser = useCallback(() => {
    cancelScheduledResume();
    setUserEngaged(true);
    setShouldPauseAfterVideo(true);
  }, [cancelScheduledResume]);

  const disengageUser = useCallback(() => {
    setUserEngaged(false);
    setShouldPauseAfterVideo(false);
  }, []);

  const pauseAfterVideoIfEngaged = useCallback(() => {
    if (shouldPauseAfterVideo && userEngaged) {
      setIsPaused(true);
      return true;
    }
    return false;
  }, [shouldPauseAfterVideo, userEngaged]);

  const handleResumeActivity = useCallback(
    (triggerType: string) => {
      if (!resumeTriggers.includes(triggerType)) return;
      setUserEngaged(false);
      setShouldPauseAfterVideo(false);
      if (isPaused) {
        scheduleResume();
      }
    },
    [isPaused, resumeTriggers, scheduleResume]
  );

  useEffect(() => () => cancelScheduledResume(), [cancelScheduledResume]);

  return {
    isPaused,
    userEngaged,
    shouldPauseAfterVideo,
    isResumeScheduled,
    scheduleResume,
    cancelScheduledResume,
    pause,
    resume,
    toggle,
    engageUser,
    disengageUser,
    pauseAfterVideoIfEngaged,
    handleResumeActivity,
  };
};
