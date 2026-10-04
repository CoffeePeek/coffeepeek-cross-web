import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { register, checkEmailExists } from '../api/auth';
import { usePageTitle } from '../hooks/usePageTitle';
import { LEGAL_ROUTES } from '../constants/legalRoutes';
import { logger } from '../utils/logger';
import { useUser } from '../contexts/UserContext';
import { parseJWT, isTokenExpired, getUserRoles } from '../utils/jwt';
import GoogleSignInButton from '../components/GoogleSignInButton';
import {
  Envelope, Lock, User, WarningCircle, Eye, EyeSlash,
  SignIn, Sparkle, ArrowLeft, Check,
} from '@/components/Icon';
import { useTheme } from '../contexts/ThemeContext';
import Mascot from '../components/Mascot';
import ThemeToggle from '../components/ThemeToggle';
import {
  parseRegistrationApiError,
  validateRegistrationEmail,
  validateRegistrationForm,
  validateRegistrationPassword,
  validateRegistrationUserName,
  type RegistrationField,
  type RegistrationFieldErrors,
} from '../utils/registrationValidation';

type RegisterStep = 'email' | 'registration' | 'success';

// ── Auth field ─────────────────────────────────────────────────────
interface AuthFieldProps {
  id: string;
  icon?: React.ReactNode; type?: string; placeholder?: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string; trailing?: React.ReactNode; autoFocus?: boolean;
  error?: string; hint?: string; dark: boolean;
  onBlur?: () => void; autoComplete?: string; maxLength?: number;
}

const AuthField: React.FC<AuthFieldProps> = ({ id, icon, type = 'text', placeholder, value, onChange, label, trailing, autoFocus, error, hint, dark, onBlur, autoComplete, maxLength }) => {
  const [focused, setFocused] = useState(false);
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <label htmlFor={id} style={{ display: 'block', textAlign: 'left' }}>
      {label && <div style={{ fontFamily: '"Manrope"', fontSize: 12, fontWeight: 600, color: dark ? '#A39E93' : '#78716C', marginBottom: 6 }}>{label}</div>}
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
            {icon}
          </span>
        )}
        <input id={id} type={type} placeholder={placeholder} value={value} onChange={onChange} autoFocus={autoFocus}
          autoComplete={autoComplete} maxLength={maxLength} aria-invalid={Boolean(error)} aria-describedby={descriptionId}
          onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); onBlur?.(); }}
          style={{
            width: '100%', height: 50, borderRadius: 12,
            border: `1px solid ${error ? '#EF4444' : focused ? '#D4A84B' : dark ? '#3D2F28' : 'rgba(158,123,54,.4)'}`,
            background: dark ? 'rgba(255,255,255,0.03)' : '#fff',
            boxShadow: focused ? '0 0 0 4px rgba(234,179,8,0.08)' : 'none',
            padding: `0 ${trailing ? 44 : 16}px 0 ${icon ? 46 : 16}px`,
            fontSize: 15, fontFamily: '"Manrope"',
            color: dark ? '#fff' : '#1C1917',
            outline: 'none', boxSizing: 'border-box', transition: 'all .15s',
          }} />
        {trailing}
      </div>
      {error && (
        <div id={`${id}-error`} role="alert" style={{ fontFamily: '"Manrope"', fontSize: 12, color: '#EF4444', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          <WarningCircle size={14} weight="fill" />{error}
        </div>
      )}
      {!error && hint && (
        <div id={`${id}-hint`} style={{ fontFamily: '"Manrope"', fontSize: 11, color: dark ? '#A39E93' : '#78716C', marginTop: 6, lineHeight: 1.4 }}>
          {hint}
        </div>
      )}
    </label>
  );
};

// ── Stepper ─────────────────────────────────────────────────────────
const Stepper: React.FC<{ step: 'email' | 'register'; dark: boolean }> = ({ step, dark }) => {
  const steps = ['Email', 'Регистрация', 'Готово'];
  const idx = step === 'email' ? 0 : 1;
  return (
    <div className="flex min-w-0 items-center justify-center gap-0.5 min-[360px]:gap-1 sm:gap-2 mb-4 sm:mb-5">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <span
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 min-[360px]:px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold"
            style={{ background: i <= idx ? 'rgba(234,179,8,0.12)' : dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', color: i <= idx ? '#EAB308' : dark ? '#A39E93' : '#78716C', fontFamily: '"Manrope"' }}
          >
            <span style={{ width: 16, height: 16, borderRadius: 99, background: i <= idx ? '#EAB308' : 'transparent', border: i <= idx ? 'none' : `1px solid ${dark ? '#3D2F28' : '#E7E5E4'}`, color: '#1A1412', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
              {i < idx ? <Check size={10} weight="bold" /> : i + 1}
            </span>
            {s}
          </span>
          {i < steps.length - 1 && <span className="h-px w-1.5 min-[360px]:w-2 sm:w-4 shrink-0" style={{ background: dark ? '#3D2F28' : '#E7E5E4' }} />}
        </React.Fragment>
      ))}
    </div>
  );
};

// ── Password strength bar ────────────────────────────────────────────
const StrengthBar: React.FC<{ password: string; dark: boolean }> = ({ password, dark }) => {
  if (!password) return null;
  const score = (password.length >= 8 ? 1 : 0) + (/\d/.test(password) ? 1 : 0) + (/[A-ZА-Я]/.test(password) ? 1 : 0);
  const colors = ['#EF4444', '#EAB308', '#22C55E'];
  const labels = ['слабый', 'средний', 'надёжный'];
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'center' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i < score ? colors[score - 1] : dark ? '#3D2F28' : '#E7E5E4' }} />
      ))}
      <span style={{ fontFamily: '"Manrope"', fontSize: 11, color: dark ? '#A39E93' : '#78716C', marginLeft: 8 }}>{labels[score - 1] || ''}</span>
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────────
const RegisterPage: React.FC = () => {
  usePageTitle('Регистрация');
  const navigate = useNavigate();
  const location = useLocation();
  const { updateUserFromToken } = useUser();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/shops';
  const [step, setStep] = useState<RegisterStep>('email');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RegistrationFieldErrors>({});
  const [agreeToPrivacy, setAgreeToPrivacy] = useState(false);
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const clearFieldError = (field: RegistrationField) => {
    setFieldErrors(current => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const showApiError = (error: unknown, context: 'register' | 'emailCheck' = 'register') => {
    const parsed = parseRegistrationApiError(error, context);
    setFieldErrors(parsed.fieldErrors);
    setGlobalError(parsed.globalError);
  };

  const handleEmailCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    const emailError = validateRegistrationEmail(email);
    if (emailError) {
      setFieldErrors({ email: emailError });
      return;
    }
    setFieldErrors({});
    setIsLoading(true);
    try {
      const response = await checkEmailExists(email.trim());
      if (response.data?.exists) {
        navigate('/login', { state: { email: email.trim() } });
      } else {
        setStep('registration');
      }
    } catch (err: unknown) {
      showApiError(err, 'emailCheck');
      logger.error('Email check error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    const validationErrors = validateRegistrationForm({ email, userName, password, agreeToPrivacy });
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsLoading(true);
    try {
      const response = await register({ email: email.trim(), password, userName: userName.trim() });
      if (!response.isSuccess) throw new Error(response.message || 'Ошибка при регистрации');
      localStorage.setItem('privacyConsent', 'accepted');
      localStorage.setItem('privacyConsentDate', new Date().toISOString());
      setStep('success');
    } catch (err: unknown) {
      showApiError(err);
      logger.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Derived colours
  const bg = dark ? '#1A1412' : '#FFFCF7';
  const cardBg = dark ? 'rgba(45,36,31,0.6)' : '#fff';
  const cardBorder = dark ? '#3D2F28' : '#E7E5E4';
  const textPrimary = dark ? '#fff' : '#1C1917';
  const textMuted = dark ? '#A39E93' : '#78716C';
  const gold = dark ? '#EAB308' : '#D4A84B';

  const PwdToggle = (
    <button type="button" onClick={() => setShowPwd(s => !s)} aria-label={showPwd ? 'Скрыть пароль' : 'Показать пароль'}
      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
      {showPwd ? <EyeSlash size={20} color={textMuted} /> : <Eye size={20} color={textMuted} />}
    </button>
  );

  return (
    <div className="min-h-[100dvh] flex items-start sm:items-center justify-center overflow-clip py-3 sm:py-6" style={{ background: bg, position: 'relative', transition: 'background .3s' }}>
      {/* Dotted pattern */}
      {dark && <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(#2D241F 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.6, pointerEvents: 'none' }} />}
      {/* Glows */}
      <div style={{ position: 'absolute', top: -120, left: -120, width: 480, height: 480, borderRadius: '50%', background: `radial-gradient(circle, rgba(234,179,8,${dark ? '0.16' : '0.08'}), transparent 60%)`, filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -160, right: -160, width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(circle, rgba(180,140,75,${dark ? '0.10' : '0.06'}), transparent 60%)`, filter: 'blur(40px)', pointerEvents: 'none' }} />

      <ThemeToggle style={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }} />

      {/* Card */}
      <div className="relative z-[2] box-border w-full max-w-[460px] px-3 pt-14 sm:p-4">
        {step !== 'success' && (
          <>
            <button
              type="button"
              className="logo-btn"
              onClick={() => navigate('/')}
              style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: 4, cursor: 'pointer', position: 'relative', zIndex: 4 }}
            >
              <span style={{ fontFamily: '"Manrope"', fontWeight: 800, letterSpacing: '-0.035em', fontSize: 22, color: textPrimary }}>
                Coffee<span style={{ color: '#EAB308' }}>Peek</span>
              </span>
            </button>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: -40, position: 'relative', zIndex: 3 }} aria-hidden>
              <Mascot pose="laptop" size={128} eager />
            </div>
          </>
        )}
        <div className={`${step === 'success' ? 'p-5 sm:p-10' : 'px-5 pb-5 pt-12 sm:p-10 sm:pt-12'} rounded-3xl`} style={{ background: cardBg, backdropFilter: dark ? 'blur(24px)' : 'none', border: `1px solid ${cardBorder}`, boxShadow: dark ? '0 24px 48px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)' : '0 8px 32px rgba(0,0,0,0.08)', transition: 'all .3s' }}>

          {/* Success screen */}
          {step === 'success' ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 8px' }} aria-hidden>
                <Mascot pose="happy" size={140} />
              </div>
              <h1 style={{ margin: '24px 0 10px', fontFamily: '"Manrope"', fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', color: textPrimary }}>Проверьте почту</h1>
              <p style={{ margin: '0 0 28px', fontFamily: '"Manrope"', fontSize: 14, color: textMuted, lineHeight: 1.6 }}>
                Мы отправили ссылку на{' '}
                <span style={{ color: textPrimary, fontWeight: 600 }}>{email}</span>.<br />
                Перейдите по ссылке чтобы активировать аккаунт.<br />
                <span style={{ fontSize: 12 }}>Ссылка действует 10 минут.</span>
              </p>
              <button
                onClick={() => navigate('/login')}
                style={{ width: '100%', height: 48, borderRadius: 12, background: gold, color: '#1A1412', border: 'none', fontFamily: '"Manrope"', fontWeight: 600, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 6px -4px rgba(180,140,75,.2), 0 10px 15px -3px rgba(180,140,75,.2)' }}>
                <SignIn size={18} />
                На страницу входа
              </button>
            </div>
          ) : (
            <>
              <Stepper step={step === 'email' ? 'email' : 'register'} dark={dark} />

              {step === 'email' ? (
                <>
                  <h1 style={{ margin: 0, fontFamily: '"Manrope"', fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', color: textPrimary }}>Введите email</h1>
                  <p style={{ margin: '8px 0 24px', fontFamily: '"Manrope"', fontSize: 14, color: textMuted, lineHeight: 1.5 }}>
                    Мы проверим, есть ли у вас уже аккаунт CoffeePeek.
                  </p>
                  <form onSubmit={handleEmailCheck} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <AuthField id="register-email" icon={<Envelope size={20} color={gold} />} type="email" placeholder="name@example.com" autoFocus autoComplete="email"
                      value={email} onChange={e => { setEmail(e.target.value); clearFieldError('email'); setGlobalError(null); }}
                      onBlur={() => { if (email.trim()) { const message = validateRegistrationEmail(email); if (message) setFieldErrors(current => ({ ...current, email: message })); } }}
                      error={fieldErrors.email} dark={dark} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: textMuted, fontSize: 11, fontFamily: '"Manrope"', margin: '2px 0' }}>
                      <div style={{ flex: 1, height: 1, background: cardBorder }} />ИЛИ<div style={{ flex: 1, height: 1, background: cardBorder }} />
                    </div>
                    <GoogleSignInButton
                      dark={dark}
                      disabled={isLoading}
                      onAuthenticated={(accessToken) => {
                        if (isTokenExpired(accessToken)) {
                          setGlobalError('Сессия Google истекла. Попробуйте войти ещё раз.');
                          return;
                        }
                        parseJWT(accessToken);
                        getUserRoles(accessToken);
                        updateUserFromToken(accessToken);
                        navigate(from, { replace: true });
                      }}
                      onError={setGlobalError}
                    />
                    {globalError && (
                      <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 10, color: '#B91C1C', background: dark ? 'rgba(239,68,68,.12)' : '#FEF2F2', border: '1px solid rgba(239,68,68,.3)', fontFamily: '"Manrope"', fontSize: 12, lineHeight: 1.45 }}>
                        <WarningCircle size={16} weight="fill" style={{ flexShrink: 0, marginTop: 1 }} />{globalError}
                      </div>
                    )}
                    <button type="submit" disabled={isLoading}
                      style={{ width: '100%', height: 48, borderRadius: 12, background: gold, color: '#1A1412', border: 'none', fontFamily: '"Manrope"', fontWeight: 600, fontSize: 15, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 6px -4px rgba(180,140,75,.2), 0 10px 15px -3px rgba(180,140,75,.2)' }}>
                      {isLoading ? <><span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: 99, display: 'inline-block', animation: 'spin 1s linear infinite' }} />Проверяем…</> : 'Продолжить'}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 99, background: 'rgba(180,140,75,.18)', color: gold, fontFamily: '"Manrope"', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                    <Sparkle size={14} /> Новый профиль
                  </span>
                  <h1 style={{ margin: '14px 0 0', fontFamily: '"Manrope"', fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', color: textPrimary }}>Создайте аккаунт</h1>
                  <div style={{ margin: '8px 0 22px', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, background: dark ? 'rgba(255,255,255,0.03)' : '#F9F8F6', border: `1px solid ${cardBorder}` }}>
                    <Envelope size={16} color="#D4A84B" />
                    <span style={{ fontFamily: '"Manrope"', fontSize: 13, color: textPrimary, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{email}</span>
                    <button type="button" onClick={() => { setStep('email'); setFieldErrors({}); setGlobalError(null); }} style={{ background: 'none', border: 'none', color: gold, fontFamily: '"Manrope"', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Изменить</button>
                  </div>
                  <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <AuthField id="register-username" icon={<User size={20} color={gold} />} placeholder="например, coffee_fan" label="Имя пользователя" autoFocus autoComplete="username" maxLength={30}
                      value={userName} onChange={e => { setUserName(e.target.value); clearFieldError('userName'); setGlobalError(null); }}
                      onBlur={() => { if (userName.trim()) { const message = validateRegistrationUserName(userName); if (message) setFieldErrors(current => ({ ...current, userName: message })); } }}
                      error={fieldErrors.userName} hint="От 3 до 30 символов: буквы, цифры, точка или _" dark={dark} />
                    <div>
                      <AuthField id="register-password" icon={<Lock size={20} color={gold} />} type={showPwd ? 'text' : 'password'} placeholder="Не менее 8 символов" label="Пароль" autoComplete="new-password"
                        value={password} onChange={e => { setPassword(e.target.value); clearFieldError('password'); setGlobalError(null); }}
                        onBlur={() => { if (password) { const message = validateRegistrationPassword(password); if (message) setFieldErrors(current => ({ ...current, password: message })); } }}
                        trailing={PwdToggle} error={fieldErrors.password} hint="Минимум 8 символов" dark={dark} />
                      <StrengthBar password={password} dark={dark} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <input
                          id="register-agree"
                          type="checkbox"
                          checked={agreeToPrivacy}
                          aria-invalid={Boolean(fieldErrors.privacy)}
                          aria-describedby={fieldErrors.privacy ? 'register-agree-error' : undefined}
                          onChange={e => { setAgreeToPrivacy(e.target.checked); if (e.target.checked) clearFieldError('privacy'); setGlobalError(null); }}
                          style={{ marginTop: 2, width: 18, height: 18, accentColor: gold, flexShrink: 0 }}
                        />
                        <label htmlFor="register-agree" style={{ fontFamily: '"Manrope"', fontSize: 12, color: textMuted, lineHeight: 1.45, cursor: 'pointer' }}>
                        Я принимаю{' '}
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); navigate(LEGAL_ROUTES.terms); }}
                          style={{ background: 'none', border: 'none', padding: 0, color: gold, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
                        >
                          Условия использования
                        </button>
                        {' '}и даю согласие на{' '}
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); navigate(LEGAL_ROUTES.privacy); }}
                          style={{ background: 'none', border: 'none', padding: 0, color: gold, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
                        >
                          обработку персональных данных
                        </button>
                        .
                        </label>
                      </div>
                      {fieldErrors.privacy && (
                        <div id="register-agree-error" role="alert" style={{ fontFamily: '"Manrope"', fontSize: 12, color: '#EF4444', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <WarningCircle size={14} weight="fill" />{fieldErrors.privacy}
                        </div>
                      )}
                    </div>
                    {globalError && (
                      <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 10, color: '#B91C1C', background: dark ? 'rgba(239,68,68,.12)' : '#FEF2F2', border: '1px solid rgba(239,68,68,.3)', fontFamily: '"Manrope"', fontSize: 12, lineHeight: 1.45 }}>
                        <WarningCircle size={16} weight="fill" style={{ flexShrink: 0, marginTop: 1 }} />{globalError}
                      </div>
                    )}
                    <button type="submit" disabled={isLoading}
                      style={{ width: '100%', height: 48, borderRadius: 12, background: gold, color: '#1A1412', border: 'none', fontFamily: '"Manrope"', fontWeight: 600, fontSize: 15, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 6px -4px rgba(180,140,75,.2), 0 10px 15px -3px rgba(180,140,75,.2)' }}>
                      {isLoading ? <><span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: 99, display: 'inline-block', animation: 'spin 1s linear infinite' }} />Создаём…</> : 'Создать аккаунт'}
                    </button>
                  </form>
                </>
              )}

              <div className="mt-[18px] flex items-center justify-between gap-2">
                <button type="button" onClick={() => step === 'registration' ? setStep('email') : navigate('/')}
                  className="whitespace-nowrap text-[11px] min-[360px]:text-xs sm:text-[13px]"
                  style={{ padding: 0, background: 'none', border: 'none', color: textMuted, fontFamily: '"Manrope"', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ArrowLeft size={14} /> Назад
                </button>
                <button type="button" onClick={() => navigate('/login')}
                  className="whitespace-nowrap text-[11px] min-[360px]:text-xs sm:text-[13px]"
                  style={{ padding: 0, background: 'none', border: 'none', color: gold, fontFamily: '"Manrope"', fontWeight: 600, cursor: 'pointer' }}>
                  Уже есть аккаунт
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
};

export default RegisterPage;
