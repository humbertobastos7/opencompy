import { Global, Module } from "@nestjs/common";
import { LocalUserController } from "./local-user.controller";
import { LocalUserService } from "./local-user.service";

@Global()
@Module({
	controllers: [LocalUserController],
	providers: [LocalUserService],
	exports: [LocalUserService],
})
export class LocalUserModule {}
