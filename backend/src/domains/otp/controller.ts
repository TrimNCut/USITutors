import type {Options} from 'nodemailer/lib/mailer';
import {prisma} from '../../config/db';
import env from '../../config/env';
import {generateOTP} from '../../utils/generateOTP';
import {hashData, verifyHashedData} from '../../utils/hashData';
import {sendEmail} from '../../utils/sendEmails';

interface SendOTP {
  email: string;
  subject: string;
  message: string;
  duration?: number;
}

export async function sendOTP({email, duration = 1, message, subject}: SendOTP) {
  if (!(email && subject && message)) {
    throw Error('Provide values for email, subject, message');
  }

  // !Clear any old record
  await prisma.otp.delete({where: {email}});

  // !Generate pin
  const generatedOTP = generateOTP();

  // !Send email
  const mailOptions: Options = {
    from: env.AUTH_EMAIL,
    to: email,
    subject,
    html: `<p>${message}</p><p style="color:tomato;font-size:25px;letter-spacing:2px;"><b>${generatedOTP}</b></p><p>This code <b>expires in $duration hours</b>.</p>`,
  };

  await sendEmail(mailOptions);

  // !Save otp record
  const hashedOTP = await hashData(generatedOTP);
  const newOTP = prisma.otp.create({
    data: {email, otp: hashedOTP, createdAt: Date.now(), expiresAt: Date.now() + 3600000 * +duration},
  });

  return newOTP;
}

export async function verifyOTP({email, otp}: {email?: string; otp?: string}) {
  if (!(email && otp)) {
    throw Error('Provide values for email and otp');
  }

  // !Ensure otp record exists
  const matchedOTPRecord = await prisma.otp.findFirst({where: {email}});

  if (!matchedOTPRecord) {
    throw Error('No otp records found.');
  }

  const {expiresAt} = matchedOTPRecord;

  // !Checking for expired code
  if (expiresAt < Date.now()) {
    await prisma.otp.delete({where: {email}});
    throw Error('Code has expired. Request for a new one.');
  }

  // !Not expired yet, verify value
  const hashedOTP = matchedOTPRecord.otp;
  const validOTP = await verifyHashedData(otp, hashedOTP);

  return validOTP;
}

export async function deleteOTP(email: string) {
  await prisma.otp.delete({where: {email}});
}