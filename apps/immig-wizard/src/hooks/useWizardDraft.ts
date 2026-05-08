"use client";

import { useEffect, useRef, useState } from "react";

import {
  clearProgress,
  clearSupplements,
  createInitialState,
  loadProgress,
  loadSupplements,
  saveProgress,
  saveSupplements
} from "@/lib/storage";
import {
  areSupplementsEqual,
  areWizardStatesEquivalent
} from "@/lib/draft-summary";
import type { FormSupplementAnswers, WizardState } from "@/types/wizard";
import {
  getWizardSessionAction,
  upsertWizardSessionAction
} from "@/server/wizard-session-actions";

const DEFAULT_FILING_SLUG = "marriage-green-card-adjustment-of-status";

function hasMeaningfulDraft(state: WizardState | null, supplements: FormSupplementAnswers) {
  if (!state) return false;

  const hasAnswers = Object.keys(state.answers).length > 0;
  const hasCompleted = state.completedSteps.length > 0;
  const hasSupplements = Object.values(supplements ?? {}).some(Boolean);

  return hasAnswers || hasCompleted || hasSupplements;
}

type DraftConflict =
  | null
  | {
      localState: WizardState;
      localSupplements: FormSupplementAnswers;
      remoteState: WizardState;
      remoteSupplements: FormSupplementAnswers;
    };

export function useWizardDraft(filingSlug = DEFAULT_FILING_SLUG) {
  const [wizardState, setWizardState] = useState<WizardState | null>(null);
  const [supplements, setSupplements] = useState<FormSupplementAnswers>({});
  const [isHydrating, setIsHydrating] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasResolvedRemote, setHasResolvedRemote] = useState(false);
  const [conflict, setConflict] = useState<DraftConflict>(null);

  const latestStateRef = useRef<WizardState | null>(null);
  const latestSupplementsRef = useRef<FormSupplementAnswers>({});

  useEffect(() => {
    const localState = loadProgress() ?? createInitialState();
    const localSupplements = loadSupplements() ?? {};

    setWizardState(localState);
    setSupplements(localSupplements);
    latestStateRef.current = localState;
    latestSupplementsRef.current = localSupplements;

    void (async () => {
      const remote = await getWizardSessionAction(filingSlug);
      setIsAuthenticated(remote.authenticated);

      if (!remote.authenticated || !remote.session) {
        setHasResolvedRemote(true);
        setIsHydrating(false);
        return;
      }

      const remoteState = remote.session.wizard_state as WizardState;
      const remoteSupplements = (remote.session.supplements ?? {}) as FormSupplementAnswers;

      const localMeaningful = hasMeaningfulDraft(localState, localSupplements);
      const remoteMeaningful = hasMeaningfulDraft(remoteState, remoteSupplements);

      if (!localMeaningful && remoteMeaningful) {
        setWizardState(remoteState);
        setSupplements(remoteSupplements);
        latestStateRef.current = remoteState;
        latestSupplementsRef.current = remoteSupplements;
        saveProgress(remoteState);
        saveSupplements(remoteSupplements);
        setHasResolvedRemote(true);
        setIsHydrating(false);
        return;
      }

      if (localMeaningful && !remoteMeaningful) {
        await upsertWizardSessionAction({
          filingSlug,
          wizardState: localState,
          supplements: localSupplements
        });
        setHasResolvedRemote(true);
        setIsHydrating(false);
        return;
      }

      if (
        localMeaningful &&
        remoteMeaningful &&
        areWizardStatesEquivalent(localState, remoteState) &&
        areSupplementsEqual(localSupplements, remoteSupplements)
      ) {
        setWizardState(localState);
        setSupplements(localSupplements);
        latestStateRef.current = localState;
        latestSupplementsRef.current = localSupplements;
        saveProgress(localState);
        saveSupplements(localSupplements);
        setHasResolvedRemote(true);
        setIsHydrating(false);
        return;
      }

      if (localMeaningful && remoteMeaningful) {
        setConflict({
          localState,
          localSupplements,
          remoteState,
          remoteSupplements
        });
        setHasResolvedRemote(true);
        setIsHydrating(false);
        return;
      }

      setHasResolvedRemote(true);
      setIsHydrating(false);
    })();
  }, [filingSlug]);

  useEffect(() => {
    if (!hasResolvedRemote || !wizardState || conflict) return;

    latestStateRef.current = wizardState;
    latestSupplementsRef.current = supplements;

    saveProgress(wizardState);
    saveSupplements(supplements);

    if (!isAuthenticated) return;

    const timeout = window.setTimeout(() => {
      void upsertWizardSessionAction({
        filingSlug,
        wizardState,
        supplements
      });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [conflict, filingSlug, hasResolvedRemote, isAuthenticated, supplements, wizardState]);

  function updateWizardState(next: WizardState | ((prev: WizardState) => WizardState)) {
    setWizardState((prev) => {
      const base = prev ?? createInitialState();
      const resolved = typeof next === "function" ? next(base) : next;
      return {
        ...resolved,
        lastUpdatedAt: new Date().toISOString()
      };
    });
  }

  function updateSupplements(next: FormSupplementAnswers) {
    setSupplements(next);
  }

  async function chooseLocalDraft() {
    if (!conflict) return;

    setWizardState(conflict.localState);
    setSupplements(conflict.localSupplements);
    saveProgress(conflict.localState);
    saveSupplements(conflict.localSupplements);

    if (isAuthenticated) {
      await upsertWizardSessionAction({
        filingSlug,
        wizardState: conflict.localState,
        supplements: conflict.localSupplements
      });
    }

    setConflict(null);
  }

  async function chooseRemoteDraft() {
    if (!conflict) return;

    setWizardState(conflict.remoteState);
    setSupplements(conflict.remoteSupplements);
    saveProgress(conflict.remoteState);
    saveSupplements(conflict.remoteSupplements);
    setConflict(null);
  }

  function resetDraft() {
    clearProgress();
    clearSupplements();
    setWizardState(createInitialState());
    setSupplements({});
  }

  return {
    wizardState,
    supplements,
    isHydrating,
    isAuthenticated,
    conflict,
    updateWizardState,
    updateSupplements,
    chooseLocalDraft,
    chooseRemoteDraft,
    resetDraft
  };
}
