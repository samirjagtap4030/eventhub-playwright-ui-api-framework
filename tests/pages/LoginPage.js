export class LoginPage {
  constructor(page) {
    this.page = page;
    this.emailInput    = page.getByPlaceholder('you@email.com');
    this.passwordInput = page.getByLabel('Password');
    this.loginBtn      = page.locator('#login-btn');
    this.logoutBtn     = page.getByTestId('logout-btn');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email, password) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginBtn.click();
    await this.logoutBtn.waitFor({ state: 'visible' });
  }
}
