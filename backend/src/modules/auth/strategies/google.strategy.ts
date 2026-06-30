import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('google.clientId') || 'GOOGLE_NOT_CONFIGURED',
      clientSecret: config.get<string>('google.clientSecret') || 'GOOGLE_NOT_CONFIGURED',
      callbackURL: config.get<string>('google.callbackUrl') || 'http://localhost:3001/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const { name, emails, photos } = profile;
    done(null, {
      email: emails[0].value,
      name: `${name.givenName} ${name.familyName}`.trim(),
      avatarUrl: photos?.[0]?.value || null,
      googleId: profile.id,
    });
  }
}
