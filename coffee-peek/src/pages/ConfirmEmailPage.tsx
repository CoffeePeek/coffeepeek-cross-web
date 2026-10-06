import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { confirmEmail } from '../api/auth';
import { isApiRequestError } from '../api/core/apiError';
import { usePageTitle } from '../hooks/usePageTitle';
import { SignIn, CaretLeft } from '@/components/Icon';
import LogoMark from '../components/LogoMark';
import Mascot from '../components/Mascot';

function getEmailConfirmationToken(searchParams: URLSearchParams): string | null {
  const tokenFromQuery = searchParams.get('token');
  if (tokenFromQuery) {
    return tokenFromQuery;
  }

  const hash = window.location.hash;
  if (!hash.startsWith('#')) {
    return null;
  }

  const tokenFromHash = hash.slice(1).split('&')[0];
  return tokenFromHash || null;
}

const ConfirmEmailPage: React.FC = () => {
  usePageTitle('Подтверждение email');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const confirmStarted = useRef(false);

  useEffect(() => {
    if (confirmStarted.current) {
      return;
    }

    const token = getEmailConfirmationToken(searchParams);
    if (!token) {
      setStatus('error');
      setErrorMessage('В ссылке отсутствует код подтверждения.');
      return;
    }

    confirmStarted.current = true;
    confirmEmail(token)
      .then(() => setStatus('success'))
      .catch((error: unknown) => {
        if (isApiRequestError(error)) {
          setErrorMessage(error.message);
        }
        setStatus('error');
      });
  }, [searchParams]);

  useEffect(() => {
    if (status !== 'success') return;
    if (countdown <= 0) {
      navigate('/login');
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [status, countdown, navigate]);

  const gold = '#EAB308';
  const cardBorder = '#3D2F28';
  const textPrimary = '#fff';
  const textMuted = '#A39E93';

  return (
    <div style={{ minHeight: '100dvh', background: '#1A1412', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(#2D241F 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.6, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: -120, left: -120, width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(234,179,8,0.16), transparent 60%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -160, right: -160, width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(180,140,75,0.10), transparent 60%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 460, margin: '0 auto', padding: 16, position: 'relative', zIndex: 2 }}>
        <div style={{ padding: 40, borderRadius: 24, background: 'rgba(45,36,31,0.6)', backdropFilter: 'blur(24px)', border: `1px solid ${cardBorder}`, boxShadow: '0 24px 48px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)', textAlign: 'center' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32 }}>
            <LogoMark size={52} variant="dark" />
            <span style={{ fontFamily: '"Manrope"', fontWeight: 700, letterSpacing: '-0.025em', fontSize: 18, color: textPrimary }}>
              Coffee<span style={{ color: gold }}>Peek</span>
            </span>
          </div>

          {status === 'loading' && (
            <>
              <div style={{ width: 72, height: 72, borderRadius: 99, background: 'rgba(234,179,8,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <span style={{ width: 32, height: 32, border: '3px solid #EAB308', borderTopColor: 'transparent', borderRadius: 99, display: 'inline-block', animation: 'spin 1s linear infinite' }} />
              </div>
              <h1 style={{ margin: '0 0 8px', fontFamily: '"Manrope"', fontWeight: 700, fontSize: 24, color: textPrimary }}>
                Подтверждаем email…
              </h1>
              <p style={{ margin: 0, fontFamily: '"Manrope"', fontSize: 14, color: textMuted }}>Пожалуйста, подождите</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 12px' }} aria-hidden>
                <Mascot pose="happy" size={140} />
              </div>
              <h1 style={{ margin: '0 0 10px', fontFamily: '"Manrope"', fontWeight: 700, fontSize: 28, color: textPrimary }}>
                Email подтверждён
              </h1>
              <p style={{ margin: '0 0 28px', fontFamily: '"Manrope"', fontSize: 14, color: textMuted, lineHeight: 1.55 }}>
                Ваш аккаунт активирован.<br />
                Перенаправляем через {countdown} сек…
              </p>
              <button
                onClick={() => navigate('/login')}
                style={{ width: '100%', height: 48, borderRadius: 12, background: gold, color: '#1A1412', border: 'none', fontFamily: '"Manrope"', fontWeight: 600, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 6px -4px rgba(180,140,75,.2), 0 10px 15px -3px rgba(180,140,75,.2)' }}>
                <SignIn size={18} />
                Войти
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 12px' }} aria-hidden>
                <Mascot pose="astonishment" size={140} />
              </div>
              <h1 style={{ margin: '0 0 10px', fontFamily: '"Manrope"', fontWeight: 700, fontSize: 24, color: textPrimary }}>
                Ссылка недействительна
              </h1>
              <p style={{ margin: '0 0 28px', fontFamily: '"Manrope"', fontSize: 14, color: textMuted, lineHeight: 1.55 }}>
                {errorMessage ?? (
                  <>
                    Ссылка для подтверждения устарела или уже использована.
                    <br />
                    Запросите новую в настройках аккаунта.
                  </>
                )}
              </p>
              <button
                onClick={() => navigate('/login')}
                style={{ width: '100%', height: 48, borderRadius: 12, background: 'transparent', color: textPrimary, border: `1px solid ${cardBorder}`, fontFamily: '"Manrope"', fontWeight: 600, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <CaretLeft size={18} />
                На страницу входа
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
};

export default ConfirmEmailPage;
