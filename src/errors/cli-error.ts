export class CliError extends Error {
  public readonly exitCode: number;

  public constructor(message: string, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
    this.name = new.target.name;
  }

  public toJSON(): Record<string, unknown> {
    return {
      exitCode: this.exitCode,
      message: this.message,
      name: this.name,
    };
  }
}

export class UsageError extends CliError {
  public constructor(message: string) {
    super(message, 2);
  }
}

export class AuthError extends CliError {
  public constructor(message: string) {
    super(message, 3);
  }
}

export class NotFoundError extends CliError {
  public constructor(message: string) {
    super(message, 4);
  }
}

export class ForbiddenError extends CliError {
  public constructor(message: string) {
    super(message, 5);
  }
}
