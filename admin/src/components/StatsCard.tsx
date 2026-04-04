interface Props {
  label: string;
  value: number | string;
  color?: string;
}

export default function StatsCard({ label, value, color = 'bg-white' }: Props) {
  return (
    <div className={`${color} rounded-lg border border-gray-200 p-5 shadow-sm`}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
