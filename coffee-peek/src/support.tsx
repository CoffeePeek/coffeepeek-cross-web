import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { sendSupportRequest } from './api/support';

const supportSchema = z.object({
  email: z.string().trim().email('Введите корректный email.').max(254, 'Email не должен превышать 254 символа.'),
  message: z.string().trim().min(10, 'Напишите не менее 10 символов.').max(4000, 'Сообщение не должно превышать 4000 символов.'),
});

type SupportFields = z.infer<typeof supportSchema>;

function SupportForm() {
  const [result, setResult] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SupportFields>({
    resolver: zodResolver(supportSchema),
    defaultValues: { email: '', message: '' },
  });

  const onSubmit = handleSubmit(async values => {
    setResult(null);
    try {
      const status = await sendSupportRequest(values);
      if (status !== 204) {
        setResult({ kind: 'error', text: 'Обращение не отправлено. Попробуйте ещё раз или напишите нам по email.' });
        return;
      }
      reset();
      setResult({ kind: 'success', text: 'Обращение отправлено. Мы ответим на ваш email.' });
    } catch (error) {
      const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
      const text = status === 400
        ? 'Проверьте email и сообщение, затем отправьте обращение ещё раз.'
        : status === 429
          ? 'Слишком много обращений. Пожалуйста, повторите позже.'
          : 'Обращение не отправлено. Попробуйте ещё раз или напишите нам по email.';
      setResult({ kind: 'error', text });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <div>
        <label htmlFor="support-email">Ваш email</label>
        <input id="support-email" type="email" autoComplete="email" placeholder="user@example.com"
          aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'support-email-error' : undefined}
          {...register('email')} />
        {errors.email && <p id="support-email-error" className="field-error" role="alert">{errors.email.message}</p>}
      </div>
      <div>
        <label htmlFor="support-message">Сообщение</label>
        <textarea id="support-message" placeholder="Расскажите, чем мы можем помочь"
          aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'support-message-error' : undefined}
          {...register('message')} />
        {errors.message && <p id="support-message-error" className="field-error" role="alert">{errors.message.message}</p>}
      </div>
      <button className="submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Отправляем…' : 'Отправить обращение'}</button>
      {result && <p className={`form-status ${result.kind}`} role={result.kind === 'error' ? 'alert' : 'status'}>{result.text}</p>}
    </form>
  );
}

const formRoot = document.getElementById('support-form');
if (formRoot) createRoot(formRoot).render(<SupportForm />);
