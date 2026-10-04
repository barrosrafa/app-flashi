export type AuthAction = 'login' | 'register' | 'recovery' | 'reset';

export function getAuthErrorMessage(error: unknown, action: AuthAction): string {
  const raw = error instanceof Error ? error.message : '';
  const normalized = raw.toLowerCase();
  if (/supabase_not_configured|supabasekey is required|invalid api key/.test(normalized)) {
    return 'A autenticação não está configurada neste ambiente. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para habilitar login e cadastro; a demonstração segue disponível sem conta.';
  }
  if (/invalid login credentials|invalid credentials|email or password/.test(normalized)) {
    return 'E-mail ou senha incorretos. Confira seus dados e tente novamente.';
  }
  if (/email not confirmed|email_not_confirmed|confirm your email/.test(normalized)) {
    return 'Confirme seu e-mail pelo link enviado antes de entrar.';
  }
  if (/rate limit|too many requests|too many attempts/.test(normalized)) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }
  if (/password.*(weak|short|least)|weak_password/.test(normalized)) {
    return 'Escolha uma senha mais forte e tente novamente.';
  }
  if (action === 'login') return 'Não foi possível entrar agora. Verifique seus dados ou tente novamente em instantes.';
  if (action === 'register') return 'Não foi possível criar sua conta agora. Confira os dados e tente novamente em instantes.';
  if (action === 'recovery') return 'Não foi possível enviar as instruções agora. Tente novamente em instantes.';
  return 'Não foi possível atualizar a senha. Abra novamente o link de recuperação ou solicite outro.';
}
