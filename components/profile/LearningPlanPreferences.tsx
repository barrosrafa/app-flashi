'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useTranslation } from '../../contexts/LanguageContext';
import {
  getOnboardingState,
  saveLearningPreferences,
  type LearningGoal,
} from '../../lib/services/onboarding-service';

export function LearningPlanPreferences() {
  const { t } = useTranslation();
  const [goal, setGoal] = useState<LearningGoal | ''>('');
  const [targetDate, setTargetDate] = useState('');
  const [weeklyMinutes, setWeeklyMinutes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    let active = true;
    getOnboardingState()
      .then(({ preferences }) => {
        if (!active) return;
        setGoal(preferences.goal ?? '');
        setTargetDate(preferences.targetDate ?? '');
        setWeeklyMinutes(preferences.weeklyMinutes === null ? '' : String(preferences.weeklyMinutes));
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setAuthRequired(reason instanceof Error && reason.message === 'AUTH_REQUIRED');
        setMessage(t('profile.learningPlanLoadError'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [t]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await saveLearningPreferences({
        goal: goal || null,
        targetDate: targetDate || null,
        weeklyMinutes: weeklyMinutes ? Number(weeklyMinutes) : null,
      });
      setMessage(t('profile.learningPlanSaved'));
    } catch {
      setMessage(t('profile.learningPlanSaveError'));
    } finally {
      setSaving(false);
    }
  }

  return <section className="card learning-plan-card" aria-labelledby="learning-plan-title">
    <div className="section-head compact-head"><div><h2 id="learning-plan-title">{t('profile.learningPlanTitle')}</h2><p className="subtitle">{t('profile.learningPlanHelp')}</p></div></div>
    {loading ? <p className="status-text" role="status">{t('onboarding.loading')}</p> : authRequired ? <div className="notice"><span>{message}</span>{' '}<Link className="inline-link" href="/login">{t('onboarding.signIn')}</Link></div> : <>
      {message && <p className={`notice ${message === t('profile.learningPlanSaved') ? 'success' : 'error'}`} role="status" aria-live="polite">{message}</p>}
      <form className="form" onSubmit={(event) => void save(event)} aria-busy={saving}>
      <div className="field"><label htmlFor="profile-learning-goal">{t('profile.learningGoal')}</label><select id="profile-learning-goal" value={goal} onChange={(event) => setGoal(event.target.value as LearningGoal | '')}><option value="">{t('profile.learningGoalNone')}</option><option value="exam">{t('onboarding.goals.exam')}</option><option value="competition">{t('onboarding.goals.competition')}</option><option value="language">{t('onboarding.goals.language')}</option><option value="university">{t('onboarding.goals.university')}</option><option value="other">{t('onboarding.goals.other')}</option></select></div>
      <div className="grid learning-plan-fields"><div className="field"><label htmlFor="profile-learning-date">{t('onboarding.targetDate')}</label><input id="profile-learning-date" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></div><div className="field"><label htmlFor="profile-learning-capacity">{t('profile.learningCapacity')}</label><input id="profile-learning-capacity" type="number" inputMode="numeric" min="15" max="10080" step="15" value={weeklyMinutes} onChange={(event) => setWeeklyMinutes(event.target.value)} placeholder={t('onboarding.capacityPlaceholder')} /></div></div>
      <button className="btn secondary" type="submit" disabled={saving}>{saving ? t('onboarding.saving') : t('profile.learningPlanSave')}</button>
      </form>
    </>}
  </section>;
}
