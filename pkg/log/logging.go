package log

import (
	"os"

	"github.com/sirupsen/logrus"
)

var log = logrus.New()

func ConfigureLog(jsonLog bool, logLevel int) {

	log.Out = os.Stdout

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

	log.Infof("log level=%s,Json=%v ", log.GetLevel(), jsonLog)
}

func Infof(format string, v ...interface{}) {
	log.Infof(format, v...)
}

func Warnf(format string, v ...interface{}) {
	log.Warnf(format, v...)
}

func Debugf(format string, v ...interface{}) {
	log.Debugf(format, v...)
}

func Tracef(format string, v ...interface{}) {
	log.Tracef(format, v...)
}

func Errorf(format string, v ...interface{}) {
	log.Errorf(format, v...)
}

func Fatalf(format string, v ...interface{}) {
	log.Fatalf(format, v...)
}
