package log

import (
	"os"

	"github.com/sirupsen/logrus"
)

var log = logrus.New()

func ConfigureLog(jsonLog bool, logLevel int) {
	// Check environment variable for output destination
	outputDest := os.Getenv("LOG_OUTPUT")
	if outputDest == "stderr" {
		log.Out = os.Stderr
	} else {
		log.Out = os.Stdout
	}

	switch {
	case logLevel == 1:
		log.Level = logrus.DebugLevel
	case logLevel >= 2:
		log.Level = logrus.TraceLevel
	default:
		log.Level = logrus.InfoLevel
	}

	if jsonLog {
		log.Formatter = &logrus.JSONFormatter{}
	}

	log.Debugf("log level=%s,Json=%v,Output=%s ", log.GetLevel(), jsonLog, log.Out)
}

func Infof(format string, v ...any) {
	log.Infof(format, v...)
}

func Warnf(format string, v ...any) {
	log.Warnf(format, v...)
}

func Debugf(format string, v ...any) {
	log.Debugf(format, v...)
}

func Tracef(format string, v ...any) {
	log.Tracef(format, v...)
}

func Errorf(format string, v ...any) {
	log.Errorf(format, v...)
}

func Fatalf(format string, v ...any) {
	log.Fatalf(format, v...)
}
