/**
 * app/(app)/profile/ProfileForm.tsx
 *
 * Client Component — owns the form UI and loading state.
 * The Server Action lives in page.tsx and is passed down as a prop.
 * useFormStatus gives us the pending state without any client-side fetch logic.
 */

'use client'

import { useFormState, useFormStatus } from 'react-dom'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProfileFormState = {
  error: string | null
}

export type ProfileFormAction = (
  state:    ProfileFormState,
  formData: FormData
) => Promise<ProfileFormState>

export type ProfileDefaults = {
  displayName: string
  whatIKnow:   string
  whatIWant:   string
}

// ── Submit button ─────────────────────────────────────────────────────────────
// Separate component so useFormStatus can reach the enclosing <form>

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      className="btn btn-primary w-full"
      disabled={pending}
    >
      {pending ? (
        <span style={{ color: 'var(--color-muted)' }}>
          Generating your profile…
        </span>
      ) : label}
    </button>
  )
}

// ── Form ──────────────────────────────────────────────────────────────────────

export function ProfileForm({
  action,
  defaults,
  isNew,
}: {
  action:   ProfileFormAction
  defaults: ProfileDefaults
  isNew:    boolean
}) {
  const [state, formAction] = useFormState(action, { error: null })

  return (
    <form action={formAction} noValidate>

      {/* Display name */}
      <div className="mb-6">
        <label htmlFor="display_name" className="label">
          Your name
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          required
          defaultValue={defaults.displayName}
          placeholder="How you'll appear to your chavruta"
          className="input"
          maxLength={60}
        />
      </div>

      {/* What I know */}
      <div className="mb-6">
        <label htmlFor="what_i_know" className="label">
          What I know
        </label>
        <textarea
          id="what_i_know"
          name="what_i_know"
          required
          defaultValue={defaults.whatIKnow}
          placeholder={
            'What do you understand deeply?\n\n' +
            'Be specific — not "economics" but "how central banks set rates and why the Taylor Rule breaks down" ' +
            'or "Ottoman land tenure systems in the 19th century".\n\n' +
            'Write what you\'d be comfortable being challenged on.'
          }
          className="input"
          style={{ minHeight: '140px', resize: 'vertical' }}
          minLength={40}
        />
        <p className="text-xs mt-1.5" style={{ color: 'var(--color-muted)' }}>
          Be honest, not impressive. The matching only works on what you actually know.
        </p>
      </div>

      {/* What I want */}
      <div className="mb-8">
        <label htmlFor="what_i_want" className="label">
          What I want to think about
        </label>
        <textarea
          id="what_i_want"
          name="what_i_want"
          required
          defaultValue={defaults.whatIWant}
          placeholder={
            'What territory do you want to think inside?\n\n' +
            'A problem you keep returning to, a domain you\'re trying to enter, ' +
            'a question that won\'t resolve.\n\n' +
            'Not "I want to learn philosophy" but "I\'ve been circling the question ' +
            'of whether free will is compatible with determinism and I can\'t get traction on it."'
          }
          className="input"
          style={{ minHeight: '140px', resize: 'vertical' }}
          minLength={40}
        />
        <p className="text-xs mt-1.5" style={{ color: 'var(--color-muted)' }}>
          This is what your chavruta needs to fill. Make it real.
        </p>
      </div>

      {/* Error */}
      {state.error && (
        <div
          className="mb-5 text-sm"
          style={{ color: 'var(--color-destructive)' }}
          role="alert"
        >
          {state.error}
        </div>
      )}

      <SubmitButton label={isNew ? 'Save and find a match' : 'Update profile'} />

    </form>
  )
}
