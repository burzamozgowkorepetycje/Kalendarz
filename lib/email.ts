import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL || 'noreply@korepetycje.pl'

export async function sendReminderEmail(
  to: string,
  name: string,
  lessonDate: string,
  lessonTime: string,
  tutorName: string
) {
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Przypomnienie o jutrzejszych zajęciach`,
      html: `
        <p>Cześć ${name},</p>
        <p>Przypominamy o jutrzejszych zajęciach z <strong>${tutorName}</strong>:</p>
        <ul>
          <li><strong>Data:</strong> ${lessonDate}</li>
          <li><strong>Godzina:</strong> ${lessonTime}</li>
        </ul>
        <p>Do zobaczenia!</p>
      `,
    })
  } catch (error) {
    console.error('Email error:', error)
  }
}

export async function sendPaymentReminderEmail(
  to: string,
  studentName: string,
  amountDue: number
) {
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Przypomnienie o płatności`,
      html: `
        <p>Cześć ${studentName},</p>
        <p>Masz zaległą płatność w wysokości <strong>${amountDue} zł</strong>.</p>
        <p>Prosimy o uregulowanie należności.</p>
      `,
    })
  } catch (error) {
    console.error('Email error:', error)
  }
}

export async function sendMeetEmail(to: string, studentName: string, tutorName: string, date: string, time: string, link: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `Link do zajęć online — ${date} ${time}`,
      html: `
        <p>Cześć ${studentName},</p>
        <p>Twoje zajęcia online z <strong>${tutorName}</strong>:</p>
        <ul>
          <li><strong>Data:</strong> ${date}</li>
          <li><strong>Godzina:</strong> ${time}</li>
        </ul>
        <p><a href="${link}">Dołącz do spotkania (Google Meet)</a></p>
        <p>${link}</p>
      `,
    })
    if (error) return { ok: false, error: error.message || 'Błąd Resend' }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Błąd email' }
  }
}

export async function sendBookingConfirmation(
  tutorEmail: string,
  tutorName: string,
  studentName: string,
  date: string,
  time: string,
  duration: number
) {
  try {
    await resend.emails.send({
      from: FROM,
      to: tutorEmail,
      subject: `Potwierdzenie rezerwacji: ${studentName}`,
      html: `
        <p>Cześć ${tutorName},</p>
        <p>Masz nową rezerwację:</p>
        <ul>
          <li><strong>Uczeń:</strong> ${studentName}</li>
          <li><strong>Data:</strong> ${date}</li>
          <li><strong>Godzina:</strong> ${time}</li>
          <li><strong>Czas trwania:</strong> ${duration} min</li>
        </ul>
      `,
    })
  } catch (error) {
    console.error('Email error:', error)
  }
}
