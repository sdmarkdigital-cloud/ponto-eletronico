'use client';
import React from 'react';

const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

interface TimePickerProps {
  value: string | undefined;
  onChange: (newValue: string) => void;
  size?: 'normal' | 'small';
}

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, size = 'normal' }) => {
  const [hour, minute] = value?.split(':') || ['', ''];

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newHour = e.target.value;
    if (!newHour) {
      onChange('');
    } else {
      onChange(`${newHour}:${minute || '00'}`);
    }
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMinute = e.target.value;
    if (!newMinute) {
      onChange('');
    } else {
      onChange(`${hour || '00'}:${newMinute}`);
    }
  };

  const selectClassName = size === 'small'
    ? "w-full bg-primary border-gray-700 rounded-md shadow-sm p-1 text-text-base text-sm focus:ring-accent focus:border-accent"
    : "w-full bg-primary border-gray-700 rounded-md shadow-sm p-2 text-text-base focus:ring-accent focus:border-accent";

  return (
    <div className="flex gap-2">
      <select value={hour} onChange={handleHourChange} className={selectClassName} aria-label="Hora">
        <option value="">Hora</option>
        {hours.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <select value={minute} onChange={handleMinuteChange} className={selectClassName} aria-label="Minutos">
        <option value="">Min</option>
        {minutes.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );
};

export default TimePicker;