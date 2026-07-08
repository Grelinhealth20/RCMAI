export const VERIFICATION_STEPS = [
  'Checking Coverage',
  'Verifying COB',
  'Verifying Provider Status',
  'Prior Auth Status',
  'Completed',
] as const

export type VerificationStep = (typeof VERIFICATION_STEPS)[number]

const STEP_DURATION_MS = 2000 // 5 steps x 2s = 10s total

/**
 * Simulates a real-time eligibility verification pipeline for a given
 * patient, invoking onStepChange as each stage completes. Resolves once
 * every step (including "Completed") has finished, roughly 10 seconds total.
 */
export function runVerificationPipeline(
  onStepChange: (stepIndex: number) => void,
): Promise<void> {
  return new Promise((resolve) => {
    let stepIndex = 0
    onStepChange(stepIndex)

    const interval = window.setInterval(() => {
      stepIndex += 1
      onStepChange(stepIndex)
      if (stepIndex >= VERIFICATION_STEPS.length - 1) {
        window.clearInterval(interval)
        window.setTimeout(resolve, STEP_DURATION_MS)
      }
    }, STEP_DURATION_MS)
  })
}
