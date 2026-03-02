import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  // Mock the AppService to avoid database connections during unit tests
  const mockAppService = {
    checkAndReduceStock: jest.fn(),
    getHealth: jest.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('reduceStock', () => {
    it('should throw BadRequestException when stock is insufficient', async () => {
      const body = { item_id: 1, quantity: 9999 };
      
      // Simulate the service throwing the specific exception
      mockAppService.checkAndReduceStock.mockRejectedValue(
        new BadRequestException('Insufficient stock')
      );

      await expect(appController.reduceStock(body)).rejects.toThrow(BadRequestException);
    });
  });
});
