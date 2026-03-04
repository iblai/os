class UrlRoutes {
  private static instance: UrlRoutes;

  private constructor() {}

  public static getInstance(): UrlRoutes {
    if (!UrlRoutes.instance) {
      UrlRoutes.instance = new UrlRoutes();
    }
    return UrlRoutes.instance;
  }

  platform = {
    explore: (platform: string) => `/platform/${platform}/explore`,
    mentorListSettings: (tenantKey: string, mentorId: string, mentorModal: string) =>
      `/platform/${tenantKey}/${mentorId}?modal=%5B%7B%22name%22%3A%22settings%22%7D%2C%7B%22name%22%3A%22edit_mentor%22%2C%22tab%22%3A%22settings%22%2C%22mentorId%22%3A%22${mentorModal}%22%7D%5D`,
  };
}

export const urlRoutes = UrlRoutes.getInstance();
