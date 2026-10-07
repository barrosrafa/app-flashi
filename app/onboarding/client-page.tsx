'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation, type TranslationKey } from '../../contexts/LanguageContext';
import {
  getOnboardingState,
  saveLearningPreferences,
  saveOnboardingDraft,
  skipOnboarding,
  type LearningGoal,
} from '../../lib/services/onboarding-service';
import { capture, normalizeErrorCode, weeklyMinutesBucket } from '../../lib/observability';

const goalKeys: Record<LearningGoal, TranslationKey> = {
  exam: 'onboarding.goals.exam',
  competition: 'onboarding.goals.competition',
  language: 'onboarding.goals.language',
  university: 'onboarding.goals.university',
  other: 'onboarding.goals.other',
};

function localToday() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function messageForError(error: unknown, t: (key: TranslationKey) => string) {
  if (!(error instanceof Error)) return t('onboarding.errors.save');
  if (error.message === 'AUTH_REQUIRED') return t('onboarding.errors.auth');
  if (error.message === 'SUPABASE_NOT_CONFIGURED') return t('onboarding.errors.setup');
  if (error.message === 'ONBOARDING_CAPACITY_INVALID') return t('onboarding.errors.capacity');
  if (error.message === 'ONBOARDING_DATE_INVALID') return t('onboarding.errors.date');
  if (error.message === 'ONBOARDING_GOAL_REQUIRED_FOR_DATE') return t('onboarding.errors.dateNeedsGoal');
  return t('onboarding.errors.save');
}

export default function OnboardingClientPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [goal, setGoal] = useState<LearningGoal | ''>('');
  const [targetDate, setTargetDate] = useState('');
  const [weeklyMinutes, setWeeklyMinutes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    capture('activation_viewed', { surface: 'onboarding' });
    getOnboardingState()
      .then(({ preferences, draft }) => {
        if (!active) return;
        const restored = draft ?? preferences;
        setGoal(restored.goal ?? '');
        setTargetDate(restored.targetDate ?? '');
        setWeeklyMinutes(restored.weeklyMinutes === null ? '' : String(restored.weeklyMinutes));
        if (draft) setStep(draft.step);
      })
      .catch((reason: unknown) => {
        if (active) setError(messageForError(reason, t));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [t]);

  async function continueToCapacity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!goal) {
      setError(t('onboarding.errors.goal'));
      return;
    }
    setSaving(true);
    try {
      await saveOnboardingDraft({
        goal,
        targetDate: targetDate || null,
        weeklyMinutes: weeklyMinutes ? Number(weeklyMinutes) : null,
        step: 2,
      });
      setStep(2);
    } catch (reason: unknown) {
      setError(messageForError(reason, t));
    } finally {
      setSaving(false);
    }
  }

  async function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!goal) {
      setStep(1);
      setError(t('onboarding.errors.goal'));
      return;
    }
    setSaving(true);
    setError('');
    const submittedAt = Date.now();
    capture('activation_submitted', { surface: 'onboarding', has_goal: Boolean(goal), has_target_date: Boolean(targetDate), weekly_minutes_bucket: weeklyMinutesBucket(weeklyMinutes) });
    try {
      await saveLearningPreferences({
        goal,
        targetDate: targetDate || null,
        weeklyMinutes: weeklyMinutes ? Number(weeklyMinutes) : null,
      });
      capture('activation_completed', { surface: 'onboarding', status: 'ACTIVE', duration_ms: Date.now() - submittedAt, request_id: null });
      router.replace('/dashboard');
      router.refresh();
    } catch (reason: unknown) {
      capture('activation_failed', { surface: 'onboarding', error_code: normalizeErrorCode(reason), status: 0, request_id: null, retryable: true });
      setError(messageForError(reason, t));
    } finally {
      setSaving(false);
    }
  }

  async function skip() {
    setSaving(true);
    setError('');
    try {
      await skipOnboarding();
      router.replace('/dashboard');
      router.refresh();
    } catch (reason: unknown) {
      setError(messageForError(reason, t));
    } finally {
      setSaving(false);
    }
  }

  async function backToGoal() {
    if (!goal) {
      setError(t('onboarding.errors.goal'));
      setStep(1);
      return;
    }
    const minutes = weeklyMinutes ? Number(weeklyMinutes) : null;
    const safeMinutes = minutes !== null && Number.isInteger(minutes) && minutes >= 15 && minutes <= 10080 ? minutes : null;
    setSaving(true);
    setError('');
    try {
      await saveOnboardingDraft({ goal, targetDate: targetDate || null, weeklyMinutes: safeMinutes, step: 1 });
      setWeeklyMinutes(safeMinutes === null ? '' : String(safeMinutes));
      setStep(1);
    } catch (reason: unknown) {
      setError(messageForError(reason, t));
    } finally {
      setSaving(false);
    }
  }

  return <main className="auth onboarding-page">
    <section className="card onboarding-card" aria-labelledby="onboarding-title" aria-busy={loading || saving}>
      <div className="onboarding-brand-row">
        <Link className="brand auth-brand" href="/dashboard" aria-label={t('onboarding.brandAria')}>flash<span>i</span></Link>
        <button className="link-button" type="button" onClick={() => void skip()} disabled={loading || saving}>{t('onboarding.skip')}</button>
      </div>
      <p className="eyebrow">{t('onboarding.eyebrow')}</p>
      <h1 id="onboarding-title">{t(step === 1 ? 'onboarding.titleGoal' : 'onboarding.titleCapacity')}</h1>
      <p className="subtitle">{t(step === 1 ? 'onboarding.introGoal' : 'onboarding.introCapacity')}</p>
      <div className="onboarding-progress" role="progressbar" aria-label={t('onboarding.progressLabel')} aria-valuemin={1} aria-valuemax={2} aria-valuenow={step}>
        <span style={{ width: `${step * 50}%` }} />
      </div>
      <p className="onboarding-step-copy">{t('onboarding.step', { current: step, total: 2 })}</p>
      {loading ? <p className="card onboarding-loading" role="status">{t('onboarding.loading')}</p> : error && !goal && error === t('onboarding.errors.auth') ? <div className="card empty-state" role="alert"><strong>{error}</strong><Link className="btn" href="/login">{t('onboarding.signIn')}</Link></div> : <>
        {step === 1 ? <form className="form onboarding-form" onSubmit={(event) => void continueToCapacity(event)}>
          <fieldset className="onboarding-fieldset">
            <legend>{t('onboarding.goalLabel')}</legend>
            <div className="goal-options">
              {(Object.keys(goalKeys) as LearningGoal[]).map((value) => <label className={`goal-option ${goal === value ? 'selected' : ''}`} key={value}>
                <input type="radio" name="goal" value={value} checked={goal === value} onChange={() => setGoal(value)} />
                <span>{t(goalKeys[value])}</span>
              </label>)}
            </div>
          </fieldset>
          <div className="field"><label htmlFor="onboarding-date">{t('onboarding.targetDate')}</label><input id="onboarding-date" type="date" min={localToday()} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} aria-describedby="onboarding-date-help" /><span className="status-text" id="onboarding-date-help">{t('onboarding.targetDateHelp')}</span></div>
          {error && <p className="notice error" role="alert">{error}</p>}
          <button className="btn" type="submit" disabled={saving}>{saving ? t('onboarding.saving') : t('onboarding.continue')}</button>
        </form> : <form className="form onboarding-form" onSubmit={(event) => void finish(event)}>
          <div className="field"><label htmlFor="weekly-minutes">{t('onboarding.weeklyCapacity')}</label><input id="weekly-minutes" type="number" inputMode="numeric" min="15" max="10080" step="15" value={weeklyMinutes} onChange={(event) => setWeeklyMinutes(event.target.value)} aria-describedby="weekly-minutes-help" placeholder={t('onboarding.capacityPlaceholder')} /><span className="status-text" id="weekly-minutes-help">{t('onboarding.weeklyCapacityHelp')}</span></div>
          <div className="notice onboarding-honesty">{t('onboarding.estimateNote')}</div>
          {error && <p className="notice error" role="alert">{error}</p>}
          <div className="section-head-actions"><button className="btn ghost" type="button" disabled={saving} onClick={() => void backToGoal()}><span data-user-content="">{t('onboarding.back')}</span></button><button className="btn" type="submit" disabled={saving}>{saving ? t('onboarding.saving') : t('onboarding.finish')}</button></div>
        </form>}
      </>}
      <p className="onboarding-footnote">{t('onboarding.editLater')}</p>
    </section>
  </main>;
}
