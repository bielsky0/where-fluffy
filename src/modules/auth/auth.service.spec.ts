import { createAuthService } from './auth.service.js';
import { AuthRepository, EMAIL_ALREADY_EXISTS_ERROR, PasswordHasher, TokenService } from './interface/auth.interface.js';
import {
  buildLoginDto,
  buildMockHasher,
  buildMockRepository,
  buildMockTokenService,
  buildRegisterDto,
  buildUser,
} from './auth.test-helpers.js';

describe('createAuthService', () => {
  let mockRepository: jest.Mocked<AuthRepository>;
  let mockHasher: jest.Mocked<PasswordHasher>;
  let mockTokenService: jest.Mocked<TokenService>;

  beforeEach(() => {
    mockRepository = buildMockRepository();
    mockHasher = buildMockHasher();
    mockTokenService = buildMockTokenService();
  });

  describe('register', () => {
    it('hashes the plaintext password and persists only the hashed value', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);
      mockHasher.hash.mockResolvedValue('hashed-value');
      mockRepository.create.mockResolvedValue(buildUser({ password: 'hashed-value' }));
      const service = createAuthService(mockRepository, mockHasher, mockTokenService);

      await service.register(buildRegisterDto({ password: 'plainTextPassword123' }));

      expect(mockHasher.hash).toHaveBeenCalledWith('plainTextPassword123');
      expect(mockRepository.create).toHaveBeenCalledTimes(1);
      const createArg = mockRepository.create.mock.calls[0][0];
      expect(createArg.password).toBe('hashed-value');
      expect(createArg.password).not.toBe('plainTextPassword123');
    });

    it('returns the created user without the password field', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);
      mockHasher.hash.mockResolvedValue('hashed-value');
      mockRepository.create.mockResolvedValue(buildUser({ id: 'user-99', password: 'hashed-value' }));
      const service = createAuthService(mockRepository, mockHasher, mockTokenService);

      const result = await service.register(buildRegisterDto());

      expect(result).toEqual({
        id: 'user-99',
        email: 'jane@example.com',
        name: 'Jane Doe',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(result).not.toHaveProperty('password');
    });

    it('rejects with a 400 when the email is already registered, without calling the hasher or repository.create', async () => {
      mockRepository.findByEmail.mockResolvedValue(buildUser());
      const service = createAuthService(mockRepository, mockHasher, mockTokenService);

      await expect(service.register(buildRegisterDto())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Ten adres e-mail jest już zajęty',
      });
      expect(mockHasher.hash).not.toHaveBeenCalled();
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('rejects with a 400 when the password is empty', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);
      const service = createAuthService(mockRepository, mockHasher, mockTokenService);

      await expect(service.register(buildRegisterDto({ password: '' }))).rejects.toMatchObject({
        statusCode: 400,
        message: 'Hasło jest wymagane',
      });
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('translates a race-condition duplicate-email error from the repository into a 400 HTTP error', async () => {
      mockRepository.findByEmail.mockResolvedValue(null); // przeszło proaktywny check...
      mockHasher.hash.mockResolvedValue('hashed-value');
      mockRepository.create.mockRejectedValue(new Error(EMAIL_ALREADY_EXISTS_ERROR)); // ...ale przegrało wyścig
      const service = createAuthService(mockRepository, mockHasher, mockTokenService);

      await expect(service.register(buildRegisterDto())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Ten adres e-mail jest już zajęty',
      });
    });

    it('propagates an unrelated repository error unchanged', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);
      mockHasher.hash.mockResolvedValue('hashed-value');
      mockRepository.create.mockRejectedValue(new Error('connection refused'));
      const service = createAuthService(mockRepository, mockHasher, mockTokenService);

      await expect(service.register(buildRegisterDto())).rejects.toThrow('connection refused');
    });
  });

  describe('login', () => {
    it('returns the user and a signed token for valid credentials', async () => {
      const storedUser = buildUser({ id: 'user-1', password: 'hashed-password' });
      mockRepository.findByEmail.mockResolvedValue(storedUser);
      mockHasher.compare.mockResolvedValue(true);
      mockTokenService.sign.mockReturnValue('signed.jwt.token');
      const service = createAuthService(mockRepository, mockHasher, mockTokenService);

      const result = await service.login(buildLoginDto({ password: 'plainTextPassword123' }));

      expect(mockHasher.compare).toHaveBeenCalledWith('plainTextPassword123', 'hashed-password');
      expect(mockTokenService.sign).toHaveBeenCalledWith({
        id: 'user-1',
        email: storedUser.email,
        name: storedUser.name,
      });
      expect(result).toEqual({
        user: { id: 'user-1', email: storedUser.email, name: storedUser.name },
        token: 'signed.jwt.token',
      });
    });

    it('rejects with a 401 when no user matches the email', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);
      const service = createAuthService(mockRepository, mockHasher, mockTokenService);

      await expect(service.login(buildLoginDto())).rejects.toMatchObject({
        statusCode: 401,
        message: 'Niepoprawny e-mail lub hasło',
      });
      expect(mockHasher.compare).not.toHaveBeenCalled();
      expect(mockTokenService.sign).not.toHaveBeenCalled();
    });

    it('rejects with a 401 when the stored user has no password set', async () => {
      mockRepository.findByEmail.mockResolvedValue(buildUser({ password: undefined }));
      const service = createAuthService(mockRepository, mockHasher, mockTokenService);

      await expect(service.login(buildLoginDto())).rejects.toMatchObject({ statusCode: 401 });
      expect(mockHasher.compare).not.toHaveBeenCalled();
    });

    it('rejects with a 401 when the password does not match', async () => {
      mockRepository.findByEmail.mockResolvedValue(buildUser());
      mockHasher.compare.mockResolvedValue(false);
      const service = createAuthService(mockRepository, mockHasher, mockTokenService);

      await expect(service.login(buildLoginDto())).rejects.toMatchObject({
        statusCode: 401,
        message: 'Niepoprawny e-mail lub hasło',
      });
      expect(mockTokenService.sign).not.toHaveBeenCalled();
    });
  });
});
