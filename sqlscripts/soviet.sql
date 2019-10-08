create database if not exists soviet;
use soviet;

drop table if exists users;

create table users (
    urid int not null auto_increment,
    urname varchar(64) not null,
    passhash char(60) not null,
    primary key ( urid ),
    unique key ( urname )
) charset = utf8;

create table devices (
    dvid int not null auto_increment,
    urid int null,
    dvname varchar(64) not null,
    passhash char(60) not null,
    sensor float(53) null,
    sensorUpdated datetime null,
    primary key ( dvid ),
    foreign key ( urid )
        references users ( urid )
        on update cascade on delete set null
) charset = utf8;
