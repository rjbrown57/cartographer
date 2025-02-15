// Copyright 2015 gRPC authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Code generated by protoc-gen-go-grpc. DO NOT EDIT.
// versions:
// - protoc-gen-go-grpc v1.5.1
// - protoc             (unknown)
// source: cartographer/v1/cartographer.proto

package proto

import (
	context "context"
	grpc "google.golang.org/grpc"
	codes "google.golang.org/grpc/codes"
	status "google.golang.org/grpc/status"
)

// This is a compile-time assertion to ensure that this generated file
// is compatible with the grpc package it is being compiled against.
// Requires gRPC-Go v1.64.0 or later.
const _ = grpc.SupportPackageIsVersion9

const (
	Cartographer_Ping_FullMethodName      = "/cartographer.v1.Cartographer/Ping"
	Cartographer_Get_FullMethodName       = "/cartographer.v1.Cartographer/Get"
	Cartographer_Add_FullMethodName       = "/cartographer.v1.Cartographer/Add"
	Cartographer_Delete_FullMethodName    = "/cartographer.v1.Cartographer/Delete"
	Cartographer_StreamGet_FullMethodName = "/cartographer.v1.Cartographer/StreamGet"
)

// CartographerClient is the client API for Cartographer service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://pkg.go.dev/google.golang.org/grpc/?tab=doc#ClientConn.NewStream.
type CartographerClient interface {
	// Connectivity Test
	Ping(ctx context.Context, in *PingRequest, opts ...grpc.CallOption) (*PingResponse, error)
	Get(ctx context.Context, in *CartographerGetRequest, opts ...grpc.CallOption) (*CartographerGetResponse, error)
	Add(ctx context.Context, in *CartographerAddRequest, opts ...grpc.CallOption) (*CartographerAddResponse, error)
	Delete(ctx context.Context, in *CartographerDeleteRequest, opts ...grpc.CallOption) (*CartographerDeleteResponse, error)
	StreamGet(ctx context.Context, in *CartographerStreamGetRequest, opts ...grpc.CallOption) (grpc.ServerStreamingClient[CartographerStreamGetResponse], error)
}

type cartographerClient struct {
	cc grpc.ClientConnInterface
}

func NewCartographerClient(cc grpc.ClientConnInterface) CartographerClient {
	return &cartographerClient{cc}
}

func (c *cartographerClient) Ping(ctx context.Context, in *PingRequest, opts ...grpc.CallOption) (*PingResponse, error) {
	cOpts := append([]grpc.CallOption{grpc.StaticMethod()}, opts...)
	out := new(PingResponse)
	err := c.cc.Invoke(ctx, Cartographer_Ping_FullMethodName, in, out, cOpts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *cartographerClient) Get(ctx context.Context, in *CartographerGetRequest, opts ...grpc.CallOption) (*CartographerGetResponse, error) {
	cOpts := append([]grpc.CallOption{grpc.StaticMethod()}, opts...)
	out := new(CartographerGetResponse)
	err := c.cc.Invoke(ctx, Cartographer_Get_FullMethodName, in, out, cOpts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *cartographerClient) Add(ctx context.Context, in *CartographerAddRequest, opts ...grpc.CallOption) (*CartographerAddResponse, error) {
	cOpts := append([]grpc.CallOption{grpc.StaticMethod()}, opts...)
	out := new(CartographerAddResponse)
	err := c.cc.Invoke(ctx, Cartographer_Add_FullMethodName, in, out, cOpts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *cartographerClient) Delete(ctx context.Context, in *CartographerDeleteRequest, opts ...grpc.CallOption) (*CartographerDeleteResponse, error) {
	cOpts := append([]grpc.CallOption{grpc.StaticMethod()}, opts...)
	out := new(CartographerDeleteResponse)
	err := c.cc.Invoke(ctx, Cartographer_Delete_FullMethodName, in, out, cOpts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *cartographerClient) StreamGet(ctx context.Context, in *CartographerStreamGetRequest, opts ...grpc.CallOption) (grpc.ServerStreamingClient[CartographerStreamGetResponse], error) {
	cOpts := append([]grpc.CallOption{grpc.StaticMethod()}, opts...)
	stream, err := c.cc.NewStream(ctx, &Cartographer_ServiceDesc.Streams[0], Cartographer_StreamGet_FullMethodName, cOpts...)
	if err != nil {
		return nil, err
	}
	x := &grpc.GenericClientStream[CartographerStreamGetRequest, CartographerStreamGetResponse]{ClientStream: stream}
	if err := x.ClientStream.SendMsg(in); err != nil {
		return nil, err
	}
	if err := x.ClientStream.CloseSend(); err != nil {
		return nil, err
	}
	return x, nil
}

// This type alias is provided for backwards compatibility with existing code that references the prior non-generic stream type by name.
type Cartographer_StreamGetClient = grpc.ServerStreamingClient[CartographerStreamGetResponse]

// CartographerServer is the server API for Cartographer service.
// All implementations must embed UnimplementedCartographerServer
// for forward compatibility.
type CartographerServer interface {
	// Connectivity Test
	Ping(context.Context, *PingRequest) (*PingResponse, error)
	Get(context.Context, *CartographerGetRequest) (*CartographerGetResponse, error)
	Add(context.Context, *CartographerAddRequest) (*CartographerAddResponse, error)
	Delete(context.Context, *CartographerDeleteRequest) (*CartographerDeleteResponse, error)
	StreamGet(*CartographerStreamGetRequest, grpc.ServerStreamingServer[CartographerStreamGetResponse]) error
	mustEmbedUnimplementedCartographerServer()
}

// UnimplementedCartographerServer must be embedded to have
// forward compatible implementations.
//
// NOTE: this should be embedded by value instead of pointer to avoid a nil
// pointer dereference when methods are called.
type UnimplementedCartographerServer struct{}

func (UnimplementedCartographerServer) Ping(context.Context, *PingRequest) (*PingResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Ping not implemented")
}
func (UnimplementedCartographerServer) Get(context.Context, *CartographerGetRequest) (*CartographerGetResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Get not implemented")
}
func (UnimplementedCartographerServer) Add(context.Context, *CartographerAddRequest) (*CartographerAddResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Add not implemented")
}
func (UnimplementedCartographerServer) Delete(context.Context, *CartographerDeleteRequest) (*CartographerDeleteResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Delete not implemented")
}
func (UnimplementedCartographerServer) StreamGet(*CartographerStreamGetRequest, grpc.ServerStreamingServer[CartographerStreamGetResponse]) error {
	return status.Errorf(codes.Unimplemented, "method StreamGet not implemented")
}
func (UnimplementedCartographerServer) mustEmbedUnimplementedCartographerServer() {}
func (UnimplementedCartographerServer) testEmbeddedByValue()                      {}

// UnsafeCartographerServer may be embedded to opt out of forward compatibility for this service.
// Use of this interface is not recommended, as added methods to CartographerServer will
// result in compilation errors.
type UnsafeCartographerServer interface {
	mustEmbedUnimplementedCartographerServer()
}

func RegisterCartographerServer(s grpc.ServiceRegistrar, srv CartographerServer) {
	// If the following call pancis, it indicates UnimplementedCartographerServer was
	// embedded by pointer and is nil.  This will cause panics if an
	// unimplemented method is ever invoked, so we test this at initialization
	// time to prevent it from happening at runtime later due to I/O.
	if t, ok := srv.(interface{ testEmbeddedByValue() }); ok {
		t.testEmbeddedByValue()
	}
	s.RegisterService(&Cartographer_ServiceDesc, srv)
}

func _Cartographer_Ping_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(PingRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(CartographerServer).Ping(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: Cartographer_Ping_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(CartographerServer).Ping(ctx, req.(*PingRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _Cartographer_Get_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(CartographerGetRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(CartographerServer).Get(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: Cartographer_Get_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(CartographerServer).Get(ctx, req.(*CartographerGetRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _Cartographer_Add_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(CartographerAddRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(CartographerServer).Add(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: Cartographer_Add_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(CartographerServer).Add(ctx, req.(*CartographerAddRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _Cartographer_Delete_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(CartographerDeleteRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(CartographerServer).Delete(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: Cartographer_Delete_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(CartographerServer).Delete(ctx, req.(*CartographerDeleteRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _Cartographer_StreamGet_Handler(srv interface{}, stream grpc.ServerStream) error {
	m := new(CartographerStreamGetRequest)
	if err := stream.RecvMsg(m); err != nil {
		return err
	}
	return srv.(CartographerServer).StreamGet(m, &grpc.GenericServerStream[CartographerStreamGetRequest, CartographerStreamGetResponse]{ServerStream: stream})
}

// This type alias is provided for backwards compatibility with existing code that references the prior non-generic stream type by name.
type Cartographer_StreamGetServer = grpc.ServerStreamingServer[CartographerStreamGetResponse]

// Cartographer_ServiceDesc is the grpc.ServiceDesc for Cartographer service.
// It's only intended for direct use with grpc.RegisterService,
// and not to be introspected or modified (even as a copy)
var Cartographer_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "cartographer.v1.Cartographer",
	HandlerType: (*CartographerServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "Ping",
			Handler:    _Cartographer_Ping_Handler,
		},
		{
			MethodName: "Get",
			Handler:    _Cartographer_Get_Handler,
		},
		{
			MethodName: "Add",
			Handler:    _Cartographer_Add_Handler,
		},
		{
			MethodName: "Delete",
			Handler:    _Cartographer_Delete_Handler,
		},
	},
	Streams: []grpc.StreamDesc{
		{
			StreamName:    "StreamGet",
			Handler:       _Cartographer_StreamGet_Handler,
			ServerStreams: true,
		},
	},
	Metadata: "cartographer/v1/cartographer.proto",
}
