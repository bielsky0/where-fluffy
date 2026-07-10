import type { Resend } from 'resend';
import { EmailSender } from './interface/auth.interface.js';
import { createAppError } from '../../shared/errors/app-error.js';

// Przyjmuje już skonstruowany klient Resend (nie sam klucz API), tak jak createJwtTokenService
// przyjmuje `secret`, nie konfigurację — pozwala testom wstrzyknąć ręcznie zbudowany mock
// `{ emails: { send: jest.fn() } }` zamiast prawdziwego SDK.
export const createResendEmailSender = (
  resendClient: Pick<Resend, 'emails'>,
  fromAddress: string,
): EmailSender => ({
  sendOtpEmail: async (to, code) => {
    const { error } = await resendClient.emails.send({
      from: fromAddress,
      to,
      subject: "Twój kod logowania — Where's Fluffy",
      html: `<p>Twój kod weryfikacyjny to <strong>${code}</strong>. Wygasa za 5 minut.</p>`,
    });
    if (error) {
      throw createAppError(502, 'Nie udało się wysłać e-maila z kodem', true, 'EMAIL_SEND_FAILED');
    }
  },
});
