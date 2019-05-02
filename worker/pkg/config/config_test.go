package config

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUnmarshallSSM(t *testing.T) {
	tests := []struct {
		name      string
		getSSM    func(name string, encrypted bool) (string, error)
		config    *Config
		expect    *Config
		expectErr error
	}{
		{
			name: "missing ssm leaves field unchanged",
			getSSM: func(name string, encrypted bool) (string, error) {
				return "", nil
			},
			config: &Config{
				PostgresURI: "something",
			},
			expect: &Config{
				PostgresURI: "something",
			},
		},
		{
			name: "sets two fields",
			getSSM: func(name string, encrypted bool) (string, error) {
				if name == "/shipcloud/postgres/uri" && encrypted {
					return "something", nil
				} else if name == "/shipcloud/s3/ship_output_bucket" && !encrypted {
					return "bucket", nil
				}

				return "", nil
			},
			config: &Config{
				PostgresURI: "something",
			},
			expect: &Config{
				PostgresURI:  "something",
				S3BucketName: "bucket",
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			req := require.New(t)
			err := UnmarshalSSM(test.config, test.getSSM)
			req.Equal(test.expectErr, err)
			req.Equal(test.expect, test.config)
		})
	}
}