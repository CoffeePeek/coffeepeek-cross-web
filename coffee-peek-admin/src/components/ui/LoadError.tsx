import { Button } from './Button';
import { Card } from './Card';

interface LoadErrorProps {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}

export function LoadError({ message, onRetry, retrying = false }: LoadErrorProps) {
  return (
    <Card role="alert" className="flex flex-wrap items-center justify-between gap-3 p-4">
      <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
      <Button variant="secondary" size="sm" loading={retrying} onClick={onRetry}>
        Повторить
      </Button>
    </Card>
  );
}
