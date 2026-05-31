import { useTheme } from '@/context/ThemeContext';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  visible: boolean;
  initial?: string | null;
  onClose: () => void;
  onConfirm: (iso?: string) => void;
}

export default function DeadlinePicker({ visible, initial, onClose, onConfirm }: Props) {
  const { colors, isDark } = useTheme();
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const next = new Date();
    next.setHours(0, 0, 0, 0);
    return next;
  });
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timeHour, setTimeHour] = useState('12');
  const [timeMinute, setTimeMinute] = useState('00');
  const [timeAmPm, setTimeAmPm] = useState<'AM' | 'PM'>('PM');

  useEffect(() => {
    if (!visible) return;
    if (!initial) {
      setDeadlineDate('');
      setDeadlineTime('');
      return;
    }
    const parsed = new Date(initial);
    if (Number.isNaN(parsed.getTime())) {
      setDeadlineDate('');
      setDeadlineTime('');
      return;
    }
    const pad = (v: number) => String(v).padStart(2, '0');
    setDeadlineDate(`${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`);
    setDeadlineTime(`${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`);
    const hh = pad(parsed.getHours());
    let hourNum = Number.parseInt(hh, 10) || 0;
    const ampm: 'AM' | 'PM' = hourNum >= 12 ? 'PM' : 'AM';
    hourNum = hourNum % 12 === 0 ? 12 : hourNum % 12;
    setTimeHour(String(hourNum).padStart(2, '0'));
    setTimeMinute(pad(parsed.getMinutes()));
    setTimeAmPm(ampm);
    const parsedMonth = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    if (!Number.isNaN(parsedMonth.getTime())) setCalendarMonth(parsedMonth);
  }, [visible, initial]);

  const formatLocalDateTime = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const formatDateValue = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  const formatDateLabel = (value: string) => {
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    const pad = (v: number) => String(v).padStart(2, '0');
    return `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)}/${parsed.getFullYear()}`;
  };

  const formatTime12From24 = (time24: string) => {
    const m = time24.match(/^(\d{2}):(\d{2})$/);
    if (!m) return time24;
    let hh = Number.parseInt(m[1], 10);
    const mm = m[2];
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12 === 0 ? 12 : hh % 12;
    return `${String(hh).padStart(2, '0')}:${mm} ${ampm}`;
  };

  const getMonthLabel = (date: Date) => {
    const months = [
      'Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12',
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const getCalendarDays = (month: Date) => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const daysInMonth = end.getDate();
    const firstDay = (start.getDay() + 6) % 7;
    const cells: Array<{ date?: Date; key: string; empty?: boolean }> = [];

    for (let i = 0; i < firstDay; i += 1) cells.push({ key: `empty-${i}`, empty: true });
    for (let day = 1; day <= daysInMonth; day += 1) cells.push({ key: formatDateValue(new Date(month.getFullYear(), month.getMonth(), day)), date: new Date(month.getFullYear(), month.getMonth(), day) });
    return cells;
  };

  const buildDeadlineFromState = () => {
    const [datePart, timePart] = [deadlineDate.trim(), deadlineTime.trim()];
    if (!datePart || !timePart) return undefined;
    const dateMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const timeMatch = timePart.match(/^(\d{2}):(\d{2})$/);
    if (!dateMatch || !timeMatch) return undefined;
    const [, yearStr, monthStr, dayStr] = dateMatch;
    const [, hourStr, minuteStr] = timeMatch;
    const year = Number.parseInt(yearStr, 10);
    const month = Number.parseInt(monthStr, 10);
    const day = Number.parseInt(dayStr, 10);
    const hour = Number.parseInt(hourStr, 10);
    const minute = Number.parseInt(minuteStr, 10);
    const next = new Date(year, month - 1, day, hour, minute, 0);
    if (Number.isNaN(next.getTime())) return undefined;
    return formatLocalDateTime(next);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.deadlineCard, { backgroundColor: colors.card, borderColor: colors.border, maxHeight: '80%' }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Hạn chót</Text>
          <Text style={[styles.deadlinePreview, { color: colors.textSecondary, marginTop: 8 }]}>Bấm vào ngày để mở lịch chọn.</Text>

          <View style={styles.deadlineInputRow}>
            <TouchableOpacity
              onPress={() => { const nextMonth = deadlineDate ? new Date(`${deadlineDate}T00:00:00`) : new Date(); if (!Number.isNaN(nextMonth.getTime())) setCalendarMonth(nextMonth); setCalendarVisible(true); }}
              activeOpacity={0.85}
              style={[styles.deadlineTextInput, { borderColor: colors.border, backgroundColor: isDark ? '#1c1c1c' : '#fff', flex: 1 }]}
            >
              <Text style={{ color: deadlineDate ? colors.text : colors.textPlaceholder }}>{deadlineDate ? formatDateLabel(deadlineDate) : 'Chọn ngày'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.deadlineTextInput, { borderColor: colors.border, backgroundColor: isDark ? '#1c1c1c' : '#fff', flex: 1 }]}
              onPress={() => {
                if (deadlineTime) {
                  const m = deadlineTime.match(/^(\d{2}):(\d{2})$/);
                  if (m) {
                    let hh = Number.parseInt(m[1], 10);
                    const mm = m[2];
                    const ampm: 'AM' | 'PM' = hh >= 12 ? 'PM' : 'AM';
                    hh = hh % 12 === 0 ? 12 : hh % 12;
                    setTimeHour(String(hh).padStart(2, '0'));
                    setTimeMinute(mm.padStart(2, '0'));
                    setTimeAmPm(ampm);
                  }
                } else {
                  setTimeHour('12'); setTimeMinute('00'); setTimeAmPm('PM');
                }
                setTimePickerVisible(true);
              }}
            >
              <Text style={{ color: deadlineTime ? colors.text : colors.textPlaceholder }}>{deadlineTime ? formatTime12From24(deadlineTime) : 'Chọn giờ'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quickActionRow}>
            <TouchableOpacity onPress={() => { const now = new Date(); const pad = (v: number) => String(v).padStart(2, '0'); setDeadlineDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`); setDeadlineTime('20:00'); }} style={styles.quickChip}>
              <Text style={styles.quickChipText}>Hôm nay 20:00</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { const now = new Date(); const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1); const pad = (v: number) => String(v).padStart(2, '0'); setDeadlineDate(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`); setDeadlineTime('18:00'); }} style={styles.quickChip}>
              <Text style={styles.quickChipText}>Ngày mai 18:00</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.deadlinePreview, { color: colors.textSecondary }]}>
            {deadlineDate && deadlineTime ? `Đã chọn: ${formatTime12From24(deadlineTime)} ${formatDateLabel(deadlineDate)}` : 'Chưa đủ ngày hoặc giờ'}
          </Text>

          <View style={styles.modalActions}>
            <TouchableOpacity onPress={() => onClose()} style={styles.modalBtn}><Text style={{ color: colors.textSecondary }}>Đóng</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { const next = buildDeadlineFromState(); onConfirm(next); }} style={styles.modalBtn}><Text style={{ color: '#0068FF', fontWeight: '700' }}>Xong</Text></TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal visible={timePickerVisible} transparent animationType="fade" onRequestClose={() => setTimePickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.timePickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Chọn giờ</Text>
            <View style={styles.timePickerRow}>
              <View style={styles.timeColumn}>
                <ScrollView>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const hh = String(i + 1).padStart(2, '0');
                    const selected = timeHour === hh;
                    return (
                      <TouchableOpacity key={hh} onPress={() => setTimeHour(hh)} style={[styles.timeItem, selected && styles.timeItemSelected]}>
                        <Text style={{ color: selected ? '#0068FF' : colors.text }}>{hh}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={styles.timeColumn}>
                <ScrollView>
                  {['00', '15', '30', '45'].map((mm) => {
                    const selected = timeMinute === mm;
                    return (
                      <TouchableOpacity key={mm} onPress={() => setTimeMinute(mm)} style={[styles.timeItem, selected && styles.timeItemSelected]}>
                        <Text style={{ color: selected ? '#0068FF' : colors.text }}>{mm}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={styles.timeColumn}>
                <ScrollView>
                  {['AM', 'PM'].map((ap) => {
                    const selected = timeAmPm === ap;
                    return (
                      <TouchableOpacity key={ap} onPress={() => setTimeAmPm(ap as 'AM' | 'PM')} style={[styles.timeItem, selected && styles.timeItemSelected]}>
                        <Text style={{ color: selected ? '#0068FF' : colors.text }}>{ap}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setTimePickerVisible(false)} style={styles.modalBtn}><Text style={{ color: colors.textSecondary }}>Huỷ</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { let hh = Number.parseInt(timeHour, 10); if (timeAmPm === 'PM' && hh < 12) hh += 12; if (timeAmPm === 'AM' && hh === 12) hh = 0; const hhStr = String(hh).padStart(2, '0'); setDeadlineTime(`${hhStr}:${timeMinute}`); setTimePickerVisible(false); }} style={styles.modalBtn}><Text style={{ color: '#0068FF', fontWeight: '700' }}>Chọn</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={calendarVisible} transparent animationType="fade" onRequestClose={() => setCalendarVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.calendarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => { const prev = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1); setCalendarMonth(prev); }} style={styles.calendarNavBtn}><Text style={{ color: '#0068FF', fontSize: 18 }}>‹</Text></TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{getMonthLabel(calendarMonth)}</Text>
              <TouchableOpacity onPress={() => { const next = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1); setCalendarMonth(next); }} style={styles.calendarNavBtn}><Text style={{ color: '#0068FF', fontSize: 18 }}>›</Text></TouchableOpacity>
            </View>

            <View style={styles.weekdayRow}>
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((item) => (<Text key={item} style={[styles.weekdayText, { color: colors.textSecondary }]}>{item}</Text>))}
            </View>

            <View style={styles.calendarGrid}>
              {getCalendarDays(calendarMonth).map((item) => {
                if (item.empty || !item.date) return <View key={item.key} style={styles.calendarDayCell} />;
                const day = item.date;
                const value = formatDateValue(day);
                const selected = deadlineDate === value;
                const today = formatDateValue(new Date()) === value;
                return (
                  <TouchableOpacity key={item.key} onPress={() => { setDeadlineDate(formatDateValue(day)); setCalendarVisible(false); }} style={[styles.calendarDayCell, { borderColor: selected ? '#0068FF' : 'transparent', backgroundColor: selected ? '#0068FF14' : 'transparent' }]}>
                    <Text style={{ color: selected ? '#0068FF' : colors.text, fontWeight: '600' }}>{item.date.getDate()}</Text>
                    {today ? <View style={styles.todayDot} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setCalendarVisible(false)} style={styles.modalBtn}><Text style={{ color: colors.textSecondary }}>Đóng</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  deadlineCard: { borderWidth: 1, borderRadius: 18, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  deadlinePreview: { marginTop: 10, fontSize: 12 },
  deadlineInputRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  deadlineTextInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  quickActionRow: { flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' },
  quickChip: { backgroundColor: '#0068FF14', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  quickChipText: { color: '#0068FF', fontWeight: '700' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  modalBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  timePickerCard: { borderWidth: 1, borderRadius: 18, padding: 16, width: '90%' },
  timePickerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  timeColumn: { width: '30%', maxHeight: 200 },
  timeItem: { paddingVertical: 10, alignItems: 'center' },
  timeItemSelected: { backgroundColor: '#0068FF14', borderRadius: 8 },
  calendarCard: { borderWidth: 1, borderRadius: 18, padding: 16 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calendarNavBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#0068FF14' },
  weekdayRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  weekdayText: { width: 34, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDayCell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  todayDot: { marginTop: 4, width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#0068FF' },
});
