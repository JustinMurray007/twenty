declare module 'intuit-oauth' {
  interface Token {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
    realmId?: string;
  }

  interface AuthResponse {
    token: Token;
    response: any;
    body: string;
    json: any;
    intuit_tid: string;
  }

  export default class OAuthClient {
    constructor(config: {
      clientId?: string;
      clientSecret?: string;
      environment?: string;
      redirectUri?: string;
      logging?: boolean;
    });

    token: Token;
    refreshUsingToken(refreshToken: string): Promise<AuthResponse>;
    authorizeUri(options: { scope: string[] | string; state?: string }): string;
    createToken(uri: string): Promise<AuthResponse>;
    isAccessTokenValid(): boolean;
  }
}
