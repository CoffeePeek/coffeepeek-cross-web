import { useNavigate } from 'react-router-dom';
import { getThemeColors } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';
import { AppIcon } from './icons';
import MapPage from './MapPage';

export default function LandingMapWidget({ embed = false }: { embed?: boolean }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  if (embed) return <MapPage embedded />;
  return <div className="overflow-hidden rounded-[28px] border" style={{ background: colors.surface, borderColor: colors.border }}>
    <MapPage embedded />
    <div className="p-6">
      <h3 className="font-extended text-2xl font-bold" style={{ color: colors.textPrimary }}>Здесь ваша следующая чашка</h3>
      <button type="button" onClick={() => navigate('/map')} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border font-semibold" style={{ background: colors.background, color: colors.textPrimary, borderColor: colors.border }}>Открыть карту<AppIcon name="arrow_forward" size={20} /></button>
    </div>
  </div>;
}
