import { useState } from 'react';
import { AlarmClock, BatteryFull, BellRing, ChevronDown, ChevronUp, Signal, Wifi } from 'lucide-react';
import type { NotificationMessage } from '../../api/notifications';
import { Button } from '../ui/Button';

type PreviewMessage = NotificationMessage & { expanded: boolean };

function IPhoneNotification({ title, body, expanded }: PreviewMessage) {
  return (
    <div className={`push-preview__ios-notification ${expanded ? 'push-preview__ios-notification--expanded' : ''}`}>
      <span className="push-preview__ios-icon" aria-hidden="true">
        <img src="/notification-preview/ios-icon-base.png" alt="" width={38} height={38} />
        <img src="/notification-preview/app-icon.png" alt="" width={38} height={38} className="push-preview__ios-app-icon" />
      </span>
      <div className="push-preview__ios-message">
        <p className="push-preview__ios-title">{title}</p>
        <p className="push-preview__ios-body">{body}</p>
        <span className="push-preview__ios-time">9:41 AM</span>
      </div>
    </div>
  );
}

function AndroidNotification({ title, body, expanded, onToggle }: PreviewMessage & { onToggle: () => void }) {
  return (
    <div className={`push-preview__android-notification ${expanded ? 'push-preview__android-notification--expanded' : ''}`}>
      <img src="/notification-preview/app-icon.png" alt="" width={32} height={32} className="push-preview__android-icon" />
      <div className="push-preview__android-content">
        <div className="push-preview__android-header">
          <span>CoffeePeek</span><span aria-hidden="true">·</span><span>Сейчас</span><BellRing size={12} aria-hidden="true" />
        </div>
        <p className="push-preview__android-title">{title}</p>
        <p className="push-preview__android-body">{body}</p>
        {expanded && <span className="push-preview__android-snooze" aria-hidden="true"><AlarmClock size={18} /></span>}
      </div>
      <button type="button" className="push-preview__android-toggle" onClick={onToggle}
        aria-label={expanded ? 'Свернуть уведомление Android' : 'Развернуть уведомление Android'} aria-expanded={expanded}>
        {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}

export function NotificationPreview({ message }: { message: NotificationMessage }) {
  const [platform, setPlatform] = useState<'ios' | 'android'>('ios');
  const [expanded, setExpanded] = useState(false);
  const title = message.title.trim() || 'Заголовок уведомления';
  const body = message.body.trim() || 'Текст уведомления';

  return (
    <aside aria-label="Предпросмотр уведомления" className="w-full min-w-0 max-w-[440px] self-start justify-self-center space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Предпросмотр</h4>
        <div role="group" aria-label="Устройство для предпросмотра" className="flex gap-1">
          <Button variant={platform === 'ios' ? 'primary' : 'secondary'} size="sm" className="min-h-10" aria-pressed={platform === 'ios'} onClick={() => setPlatform('ios')}>iPhone</Button>
          <Button variant={platform === 'android' ? 'primary' : 'secondary'} size="sm" className="min-h-10" aria-pressed={platform === 'android'} onClick={() => setPlatform('android')}>Android</Button>
        </div>
      </div>
      <div className={`push-preview__screen push-preview__screen--${platform}`}>
        <div className="push-preview__status-bar" aria-hidden="true">
          <span>9:41</span>
          <span className="push-preview__system-icons"><Signal size={15} /><Wifi size={15} /><BatteryFull size={19} /></span>
        </div>
        {platform === 'ios' ? <IPhoneNotification title={title} body={body} expanded={expanded} />
          : <AndroidNotification title={title} body={body} expanded={expanded} onToggle={() => setExpanded(value => !value)} />}
        <span className="push-preview__home-indicator" aria-hidden="true" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-text-muted dark:text-stone-400">
        <span>{platform === 'ios' ? 'Экран блокировки iPhone' : 'Шторка уведомлений Android'}</span>
        <Button variant="ghost" size="sm" className="min-h-10 gap-1.5 px-2" aria-pressed={expanded} onClick={() => setExpanded(value => !value)}>
          {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}{expanded ? 'Свернуть' : 'Развернуть'}
        </Button>
      </div>
    </aside>
  );
}
