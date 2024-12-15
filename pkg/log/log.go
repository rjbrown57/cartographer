package log

import "go.uber.org/zap"

func Init() *zap.Logger {
	logger, _ := zap.NewProduction()
	zap.RedirectStdLog(logger)
	return logger
}
