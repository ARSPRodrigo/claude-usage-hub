import { useSessionDetail } from '@/api/hooks';
import { ModelBreakdownTable } from './ModelBreakdownTable';

interface SessionDetailProps {
  sessionId: string;
}

export function SessionDetail({ sessionId }: SessionDetailProps) {
  const { data, isLoading } = useSessionDetail(sessionId);

  return <ModelBreakdownTable data={data ?? []} isLoading={isLoading} />;
}
