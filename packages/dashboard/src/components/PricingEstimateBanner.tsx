import { AlertTriangle } from 'lucide-react';
import { getUser, isPlatformAdmin } from '@/api/client';
import { useModelPricingStatus } from '@/api/hooks';

/**
 * Warns platform admins when usage includes Claude models that aren't in the
 * hub's price table yet, so their costs are estimates until the next release.
 */
export function PricingEstimateBanner({ linkToModels = true }: { linkToModels?: boolean }) {
  const isAdmin = isPlatformAdmin(getUser()?.role);
  const { data } = useModelPricingStatus(isAdmin);
  const estimated = data?.models.filter((m) => m.source === 'estimated') ?? [];
  if (!isAdmin || estimated.length === 0) return null;

  return (
    <div
      className="flex items-start gap-2.5 px-4 py-3 mb-4 rounded-card text-[13px]"
      style={{
        border: '1px solid color-mix(in oklch, var(--accent) 35%, var(--line))',
        background: 'color-mix(in oklch, var(--accent) 7%, var(--surface))',
      }}
    >
      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
      <div className="text-ink-2">
        <span className="font-medium text-ink">Estimated costs: </span>
        {estimated.map((m) => m.displayName).join(', ')}
        {estimated.length === 1 ? ' is' : ' are'} not in the price table yet and
        {estimated.length === 1 ? ' is' : ' are'} priced like the nearest listed model. Costs correct themselves
        once a release adds the official price.
        {linkToModels && (
          <> <a href="/manage/models" className="underline text-ink">See models</a></>
        )}
      </div>
    </div>
  );
}
