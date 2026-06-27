export interface Tutor {
  id: string
  name: string
  email: string
  phone: string | null
  unique_link: string
  hourly_rate: number | null
  rate_individual: number | null
  rate_pair: number | null
  rate_group: number | null
  active: boolean
  created_at: string
}

export interface LessonStudent {
  id: string
  lesson_id: string
  student_id: string
  amount_due: number | null
  payment_status: 'unpaid' | 'paid'
  created_at: string
  students?: Pick<Student, 'name' | 'email' | 'phone'>
}

export interface Student {
  id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  rate_individual: number | null
  rate_pair: number | null
  rate_group: number | null
  created_at: string
}

export interface Lesson {
  id: string
  date: string
  start_time: string
  end_time: string
  duration_minutes: number
  tutor_id: string | null
  student_id: string | null
  status: 'available' | 'booked' | 'completed' | 'cancelled'
  attendance: 'present' | 'absent' | null
  payment_status: 'unpaid' | 'paid'
  amount_due: number | null
  reminder_sent: boolean
  room: string | null
  is_group: boolean
  tutor_amount: number | null
  lesson_type: string | null
  subject: string | null
  series_id: string | null
  created_at: string
  // joins
  tutors?: Pick<Tutor, 'name' | 'email' | 'phone'>
  students?: Pick<Student, 'name' | 'email' | 'phone'>
}

export interface Payment {
  id: string
  student_id: string
  lesson_id: string
  amount: number
  paid_at: string
  notes: string | null
}
