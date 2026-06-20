export class AuthConstants {
  public static readonly VENDOR = "VENDOR";
  public static readonly CUSTOMER = "CUSTOMER";
  public static readonly ADMIN = "ADMIN";

  public static readonly VALID_USER_TYPES = [
    AuthConstants.VENDOR,
    AuthConstants.CUSTOMER,
    AuthConstants.ADMIN
  ];

  public static isValidUserType(userType: string): boolean {
    return AuthConstants.VALID_USER_TYPES.includes(userType.toUpperCase());
  }
}

