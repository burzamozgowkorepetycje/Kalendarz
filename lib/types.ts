export interface Tutor {
  id: string
  name: string
  email: string
  phone: string | null
  unique_link: string
  hourly_rate: number | null
  meet_link: string | null
  subjects: string[] | null
  works_online: boolean
  works_onsite: boolean
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
  attendance: 'present' | 'absent' | 'na' | null
  created_at: string
  students?: Pick<Student, 'name' | 'email' | 'phone'>
}

export type StudentStatus = 'potencjalny' | 'zapisany' | 'aktywny' | 'zawieszony' | 'zakończył'

export interface Student {
  id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  birth_date: string | null
  grade: string | null
  location: string | null
  status: StudentStatus
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
  location: string
  is_group: boolean
  tutor_amount: number | null
  lesson_type: string | null
  subject: string | null
  series_id: string | null
  // Obecność uzupełniana przez korepetytora
  attendance_status: 'present' | 'absent' | 'not_held' | null
  attendance_submitted: boolean
  attendance_submitted_by: string | null
  attendance_submitted_at: string | null
  attendance_note: string | null
  attendance_reviewed: boolean
  needs_makeup: boolean
  count_toward_earnings: boolean
  created_at: string
  // joins
  tutors?: Pick<Tutor, 'name' | 'email' | 'phone'>
  students?: Pick<Student, 'name' | 'email' | 'phone'>
}

export interface StudentEnrollment {
  id: string
  student_id: string
  subject: string
  mode: 'individual' | 'group'
  location: 'Wyszków' | 'Online'
  duration_minutes: number
  group_name: string | null
  level: 'podstawowa' | 'rozszerzona' | null
  is_maturzysta: boolean
  is_e8: boolean
  active: boolean
  cancelled_at: string | null
  created_at: string
}

export interface CourseGroup {
  id: string
  name: string
  subject: string
  level: 'podstawowa' | 'rozszerzona' | null
  is_maturzysta: boolean
  is_e8: boolean
  location: 'Wyszków' | 'Online'
  duration_minutes: number
  active: boolean
  created_at: string
}

export interface Payment {
  id: string
  student_id: string
  lesson_id: string
  amount: number
  paid_at: string
  notes: string | null
}
