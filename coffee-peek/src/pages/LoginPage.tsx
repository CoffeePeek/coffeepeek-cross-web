import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { login, resendEmailConfirmationByEmail } from '../api/auth';
import { parseJWT, isTokenExpired, getUserRoles } from '../utils/jwt';
import { useUser } from '../contexts/UserContext';
import { getErrorMessage } from '../utils/errorHandler';
import { usePageTitle } from '../hooks/usePageTitle';
import GoogleSignInButton from '../components/GoogleSignInButton';
import {
  Envelope, Lock, WarningCircle, Eye, EyeSlash,
  CheckCircle, Clock, ArrowClockwise, ArrowLeft, Check, X,
} from '@/components/Icon';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import Mascot from '../components/Mascot';
import { forceLogoutMessage } from '../realtime/forceLogout';
import { TokenManager } from '../api/core/interceptors';

interface AuthFieldProps {
  icon?: React.ReactNode;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  trailing?: React.ReactNode;
  autoFocus?: boolean;
  error?: string;
  dark: boolean;
}

const AuthField: React.FC<AuthFieldProps> = ({ icon, type = 'text', placeholder, value, onChange, label, trailing, autoFocus, error, dark }) => {
  const [focused, setFocused] = useState(false);
  return (
    <label style={{ display: 'block', textAlign: 'left' }}>
      {label && <div style={{ fontFamily: '"Manrope"', fontSize: 12, fontWeight: 600, color: dark ? '#A39E93' : '#78716C', marginBottom: 6 }}>{label}</div>}
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
            {icon}
          </span>
        )}
        <input
          type={type} placeholder={placeholder} value={value} onChange={onChange} autoFocus={autoFocus}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            width: '100%', height: 50, borderRadius: 999,
            border: `1px solid ${error ? '#EF4444' : focused ? '#D4A84B' : dark ? '#3D2F28' : 'rgba(158,123,54,.4)'}`,
            background: dark ? 'rgba(255,255,255,0.03)' : '#fff',
            boxShadow: focused ? '0 0 0 4px rgba(234,179,8,0.08)' : 'none',
            padding: `0 ${trailing ? 44 : 16}px 0 ${icon ? 46 : 16}px`,
            fontSize: 15, fontFamily: '"Manrope"',
            color: dark ? '#fff' : '#1C1917',
            outline: 'none', boxSizing: 'border-box', transition: 'all .15s',
          }}
        />
        {trailing}
      </div>
      {error && (
        <div style={{ fontFamily: '"Manrope"', fontSize: 12, color: '#EF4444', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          <WarningCircle size={14} weight="fill" />{error}
        </div>
      )}
    </label>
  );
};

const Stepper: React.FC<{ dark: boolean }> = ({ dark }) => {
  const steps = ['Email', 'Вход', 'Готово'];
  return (
    <div className="mb-4 flex min-w-0 items-center justify-center gap-0.5 min-[360px]:gap-1 sm:mb-5 sm:gap-2">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-1 text-[10px] font-semibold min-[360px]:px-2 sm:px-2.5 sm:text-[11px]" style={{
            background: i <= 1 ? 'rgba(234,179,8,0.12)' : dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            color: i <= 1 ? '#EAB308' : dark ? '#A39E93' : '#78716C',
            fontFamily: '"Manrope"',
          }}>
            <span style={{ width: 16, height: 16, borderRadius: 99, background: i <= 1 ? '#EAB308' : 'transparent', border: i <= 1 ? 'none' : `1px solid ${dark ? '#3D2F28' : '#E7E5E4'}`, color: '#1A1412', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
              {i < 1 ? <Check size={10} weight="bold" /> : i + 1}
            </span>
            {s}
          </span>
          {i < steps.length - 1 && <span className="h-px w-1.5 shrink-0 min-[360px]:w-2 sm:w-4" style={{ background: dark ? '#3D2F28' : '#E7E5E4' }} />}
        </React.Fragment>
      ))}
    </div>
  );
};

const LoginPage: React.FC = () => {
  usePageTitle('Вход');
  const navigate = useNavigate();
  const location = useLocation();
  const { updateUserFromToken } = useUser();
  const returnLocation = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;
  const from = (returnLocation?.pathname || '/shops') + (returnLocation?.search || '') + (returnLocation?.hash || '');
  const passedEmail = (location.state as { email?: string } | null)?.email || '';
  const sessionReason = new URLSearchParams(location.search).get('reason');
  const sessionMessage = sessionReason ? forceLogoutMessage(sessionReason) : null;

  const [email, setEmail] = useState(passedEmail);
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendCooldown, setResendCooldown] = useState(0);
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [emailValidDebounced, setEmailValidDebounced] = useState(false);

  // Дебаунс валидации email — обновляем индикатор через 400ms после последнего ввода
  useEffect(() => {
    const t = setTimeout(() => {
      setEmailValidDebounced(/\S+@\S+\.\S+/.test(email.trim()));
    }, 400);
    return () => clearTimeout(t);
  }, [email]);

  // Countdown for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (resendCooldown > 0 || resendState === 'sending') return;
    setResendState('sending');
    try {
      await resendEmailConfirmationByEmail(email.trim());
      setResendState('sent');
      setResendCooldown(60);
    } catch {
      setResendState('error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) { setError('Введите email'); return; }
    if (!password) { setError('Введите пароль'); return; }
    setIsLoading(true);
    try {
      const response = await login({ email, password });
      if (!response.data?.accessToken) throw new Error('Токен не получен от сервера');
      const { accessToken } = response.data;
      if (isTokenExpired(accessToken)) throw new Error('Токен истёк');
      parseJWT(accessToken);
      getUserRoles(accessToken);
      TokenManager.setAccessToken(accessToken);
      updateUserFromToken(accessToken);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const rawMsg = (err as any)?.message || '';
      if (rawMsg.toLowerCase().includes('not confirmed')) {
        setEmailNotConfirmed(true);
        setError(null);
        // Auto-send a new confirmation email
        setResendState('sending');
        resendEmailConfirmationByEmail(email.trim())
          .then(() => { setResendState('sent'); setResendCooldown(60); })
          .catch(() => { setResendState('idle'); });
      } else {
        setEmailNotConfirmed(false);
        setError(getErrorMessage(err, 'login'));
      }
    } finally {
      setIsLoading(false);
    }
  };

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
    <div className="min-h-[100dvh] flex items-start justify-center overflow-clip py-3 sm:items-center sm:py-6" style={{ background: bg, position: 'relative', transition: 'background .3s' }}>
      {/* Dotted pattern (dark only) */}
      {dark && <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(#2D241F 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.6, pointerEvents: 'none' }} />}
      {/* Gold glows */}
      <div style={{ position: 'absolute', top: -120, left: -120, width: 480, height: 480, borderRadius: '50%', background: `radial-gradient(circle, rgba(234,179,8,${dark ? '0.16' : '0.08'}), transparent 60%)`, filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -160, right: -160, width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(circle, rgba(180,140,75,${dark ? '0.10' : '0.06'}), transparent 60%)`, filter: 'blur(40px)', pointerEvents: 'none' }} />

      <ThemeToggle style={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }} />

      {emailNotConfirmed && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 64,
            right: 16,
            left: 16,
            zIndex: 40,
            display: 'flex',
            justifyContent: 'flex-end',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              pointerEvents: 'auto',
              width: 'min(100%, 380px)',
              padding: '14px 16px',
              borderRadius: 16,
              background: dark ? '#2D241F' : '#FFFCF2',
              border: `1px solid ${dark ? 'rgba(234,179,8,0.35)' : 'rgba(212,168,75,0.45)'}`,
              boxShadow: dark ? '0 16px 40px -12px rgba(0,0,0,0.55)' : '0 12px 32px -10px rgba(28,25,23,0.16)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <WarningCircle size={20} weight="fill" color="#EAB308" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontFamily: '"Manrope"', fontWeight: 700, fontSize: 13, color: gold, lineHeight: 1.4 }}>
                  Email не подтверждён
                </p>
                <p style={{ margin: '4px 0 0', fontFamily: '"Manrope"', fontSize: 13, color: dark ? '#E7E5E4' : '#57534E', lineHeight: 1.5 }}>
                  {resendState === 'sending'
                    ? 'Отправляем письмо подтверждения…'
                    : resendState === 'sent'
                      ? <>Новое письмо отправлено на <span style={{ fontWeight: 600 }}>{email}</span>. Проверьте почту.</>
                      : resendState === 'error'
                        ? <>Не удалось отправить письмо. Попробуйте ещё раз или зайдите в <span style={{ fontWeight: 600 }}>Настройки → Безопасность</span>.</>
                        : <>Найдите письмо от <span style={{ fontWeight: 600 }}>info@coffeepeek.by</span> и перейдите по ссылке.</>
                  }
                </p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendState === 'sending' || resendCooldown > 0}
                  style={{
                    marginTop: 10,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: `1px solid ${dark ? 'rgba(234,179,8,0.4)' : 'rgba(212,168,75,0.5)'}`,
                    background: dark ? 'rgba(234,179,8,0.12)' : 'rgba(212,168,75,0.12)',
                    color: gold,
                    fontFamily: '"Manrope"',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: resendState === 'sending' || resendCooldown > 0 ? 'not-allowed' : 'pointer',
                    opacity: resendState === 'sending' || resendCooldown > 0 ? 0.6 : 1,
                  }}
                >
                  {resendState === 'sending'
                    ? <><span style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: 99, display: 'inline-block', animation: 'spin 1s linear infinite' }} />Отправляем…</>
                    : resendCooldown > 0
                      ? <><Clock size={14} />Повторно через {resendCooldown}с</>
                      : <><ArrowClockwise size={14} />Отправить письмо повторно</>
                  }
                </button>
              </div>
              <button
                type="button"
                onClick={() => setEmailNotConfirmed(false)}
                aria-label="Закрыть уведомление"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: textMuted, flexShrink: 0 }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card */}
      <div className="relative z-[2] box-border w-full max-w-[460px] px-3 pt-14 sm:p-4">
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
        <div className="rounded-3xl px-5 pb-5 pt-12 sm:p-10 sm:pt-12" style={{ background: cardBg, backdropFilter: dark ? 'blur(24px)' : 'none', border: `1px solid ${cardBorder}`, boxShadow: dark ? '0 24px 48px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)' : '0 8px 32px rgba(0,0,0,0.08)', transition: 'all .3s' }}>

          {passedEmail && <Stepper dark={dark} />}

          {passedEmail && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 99, background: 'rgba(34,197,94,.14)', color: dark ? '#22C55E' : '#15803D', fontFamily: '"Manrope"', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
              <CheckCircle size={14} weight="fill" color="#22C55E" />
              Аккаунт найден
            </span>
          )}

          <h1 style={{ margin: passedEmail ? '14px 0 0' : '0 0 4px', fontFamily: '"Manrope"', fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', color: textPrimary }}>
            {passedEmail ? 'С возвращением!' : 'Вход в аккаунт'}
          </h1>

          {!passedEmail && (
            <p style={{ margin: '0 0 20px', fontFamily: '"Manrope"', fontSize: 14, color: textMuted, lineHeight: 1.5 }}>
              Войдите в свой аккаунт CoffeePeek.
            </p>
          )}

          {sessionMessage && (
            <div
              role="status"
              style={{
                marginBottom: 16,
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(234,179,8,0.09)',
                border: '1px solid rgba(234,179,8,0.30)',
                fontFamily: '"Manrope", sans-serif',
                fontSize: 13,
                color: gold,
                lineHeight: 1.5,
              }}
            >
              {sessionMessage}
            </div>
          )}

          <div style={{ marginTop: passedEmail ? 20 : 0, marginBottom: 14 }}>
            <GoogleSignInButton
              dark={dark}
              disabled={isLoading}
              onAuthenticated={(accessToken) => {
                if (isTokenExpired(accessToken)) {
                  setError('Токен истёк');
                  return;
                }
                parseJWT(accessToken);
                getUserRoles(accessToken);
                updateUserFromToken(accessToken);
                navigate(from, { replace: true });
              }}
              onError={setError}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: textMuted, fontSize: 11, fontFamily: '"Manrope"', marginBottom: 14 }}>
            <div style={{ flex: 1, height: 1, background: cardBorder }} />ИЛИ<div style={{ flex: 1, height: 1, background: cardBorder }} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <AuthField
              icon={<Envelope size={20} color={gold} />}
              type="email"
              placeholder="name@example.com"
              label="Email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null); setEmailNotConfirmed(false); setResendState('idle'); setResendCooldown(0); }}
              dark={dark}
              trailing={emailValidDebounced ? (
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
                  <CheckCircle size={18} weight="fill" color="#22C55E" />
                </span>
              ) : undefined}
            />

            <AuthField icon={<Lock size={20} color={gold} />} type={showPwd ? 'text' : 'password'} placeholder="Пароль" label="Пароль"
              value={password} onChange={e => setPassword(e.target.value)} trailing={PwdToggle} error={error || undefined} dark={dark} />

            <div style={{ textAlign: 'right', marginTop: -6 }}>
              <Link to="/forgot-password" style={{ fontFamily: '"Manrope"', fontSize: 13, color: gold, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>Забыли пароль?</Link>
            </div>

            <button type="submit" disabled={isLoading || !password}
              style={{ width: '100%', height: 48, borderRadius: 999, background: gold, color: '#1A1412', border: 'none', fontFamily: '"Manrope"', fontWeight: 600, fontSize: 15, cursor: isLoading || !password ? 'not-allowed' : 'pointer', opacity: !password ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 6px -4px rgba(180,140,75,.2), 0 10px 15px -3px rgba(180,140,75,.2)', transition: 'opacity .2s' }}>
              {isLoading ? (
                <><span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: 99, display: 'inline-block', animation: 'spin 1s linear infinite' }} />Входим…</>
              ) : 'Войти'}
            </button>
          </form>

          <div className="mt-[18px] flex items-center justify-between gap-2">
            <button type="button" onClick={() => navigate(passedEmail ? '/register' : '/')}
              className="whitespace-nowrap text-[11px] min-[360px]:text-xs sm:text-[13px]"
              style={{ padding: 0, background: 'none', border: 'none', color: textMuted, fontFamily: '"Manrope"', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ArrowLeft size={14} /> Назад
            </button>
            <button type="button" onClick={() => navigate('/register')}
              className="whitespace-nowrap text-[11px] min-[360px]:text-xs sm:text-[13px]"
              style={{ padding: 0, background: 'none', border: 'none', color: gold, fontFamily: '"Manrope"', fontWeight: 600, cursor: 'pointer' }}>
              Создать аккаунт
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
};

export default LoginPage;
