import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../../../config/env';
import { SMS_PROVIDER, type SmsProvider } from './sms.provider';
import { NotifyLkProvider } from './notifylk.provider';
import { IdeabizProvider } from './ideabiz.provider';
import { ConsoleSmsProvider } from './console.provider';

@Global()
@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env): SmsProvider => {
        switch (env.SMS_PROVIDER) {
          case 'NOTIFYLK':
            return new NotifyLkProvider(env);
          case 'IDEABIZ':
            return new IdeabizProvider(env);
          case 'CONSOLE':
            return new ConsoleSmsProvider();
        }
      },
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
